import { Gauge } from 'prom-client'

import { Hub, StatelessVmMap } from '../../types'
import { status } from '../../utils/status'
import { LazyPluginVM } from '../vm/lazy'
import { loadPlugin } from './loadPlugin'
import { loadPluginsFromDB } from './loadPluginsFromDB'
import { loadSchedule } from './loadSchedule'
import { teardownPlugins } from './teardown'

export const importUsedGauge = new Gauge({
    name: 'plugin_import_used',
    help: 'Imports used by plugins, broken down by import name and plugin_id',
    labelNames: ['name', 'plugin_id'],
})

export async function setupPlugins(hub: Hub): Promise<void> {
    const startTime = Date.now()
    status.info('🔁', `Loading plugin configs...`)
    const { plugins, pluginConfigs, pluginConfigsPerTeam } = await loadPluginsFromDB(hub)
    const pluginVMLoadPromises: Array<Promise<any>> = []
    const statelessVms = {} as StatelessVmMap

    const timer = new Date()

    for (const [id, pluginConfig] of pluginConfigs) {
        const plugin = plugins.get(pluginConfig.plugin_id)
        const prevConfig = hub.pluginConfigs.get(id)
        const prevPlugin = prevConfig ? hub.plugins.get(pluginConfig.plugin_id) : null

        const pluginConfigChanged = !prevConfig || pluginConfig.updated_at !== prevConfig.updated_at
        const pluginChanged = plugin?.updated_at !== prevPlugin?.updated_at

        if (!pluginConfigChanged && !pluginChanged) {
            pluginConfig.vm = prevConfig.vm
        } else if (plugin?.is_stateless && statelessVms[plugin.id]) {
            pluginConfig.vm = statelessVms[plugin.id]
        } else {
            pluginConfig.vm = new LazyPluginVM(hub, pluginConfig)
            if (hub.PLUGIN_LOAD_SEQUENTIALLY) {
                await loadPlugin(hub, pluginConfig)
            } else {
                pluginVMLoadPromises.push(loadPlugin(hub, pluginConfig))
            }
            if (prevConfig) {
                void teardownPlugins(hub, prevConfig)
            }

            if (plugin?.is_stateless) {
                statelessVms[plugin.id] = pluginConfig.vm
            }
        }
    }

    await Promise.all(pluginVMLoadPromises)
    hub.statsd?.timing('setup_plugins.success', timer)

    hub.plugins = plugins
    hub.pluginConfigs = pluginConfigs
    hub.pluginConfigsPerTeam = pluginConfigsPerTeam

    importUsedGauge.reset()
    const seenPlugins = new Set<number>()
    for (const pluginConfig of pluginConfigs.values()) {
        const usedImports = pluginConfig.vm?.usedImports
        if (usedImports && !seenPlugins.has(pluginConfig.plugin_id)) {
            seenPlugins.add(pluginConfig.plugin_id)
            for (const importName of usedImports) {
                importUsedGauge.set({ name: importName, plugin_id: pluginConfig.plugin_id }, 1)
            }
        }
    }

    for (const teamId of hub.pluginConfigsPerTeam.keys()) {
        hub.pluginConfigsPerTeam.get(teamId)?.sort((a, b) => a.order - b.order)
    }

    // Only load the schedule in server that can process scheduled tasks, else the schedule won't be useful
    if (hub.capabilities.pluginScheduledTasks) {
        await loadSchedule(hub)
    }

    status.info(
        '✅',
        `Loaded ${pluginConfigs.size} configs for ${plugins.size} plugins, took ${Date.now() - startTime}ms`
    )
}
