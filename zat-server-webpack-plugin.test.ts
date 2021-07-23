import path from "path"
import fs from "fs/promises"
import { Compiler } from "webpack"
import ZATServerPlugin from "./zat-server-webpack-plugin"

const testdir = Math.random().toString(16).slice(2, 8)

const mockCompiler = {
    hooks: {
        afterEmit: {
            tap(_name: string, fn: () => void) {
                fn()
            },
        },
    },
} as Compiler

const timeout = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms))

const processExit = jest.spyOn(process, "exit").mockImplementation()

jest.spyOn(console, "log").mockImplementation()

test("Options format", () => {
    const plugin = new ZATServerPlugin({
        a: "short",
        aa: "long",
        undefined: undefined,
        camelCase: 1,
    })
    expect(plugin.args).toEqual([
        "-a",
        "short",
        "--aa",
        "long",
        "--undefined",
        "--camel-case",
        "1",
    ])
})

test("Manifest path", () => {
    let plugin = new ZATServerPlugin()
    expect(plugin.manifest).toEqual(__dirname + "/manifest.json")

    plugin = new ZATServerPlugin({
        path: "relative/path",
    })
    expect(plugin.manifest).toEqual(__dirname + "/relative/path/manifest.json")

    plugin = new ZATServerPlugin({
        path: __dirname + "/absolute/path",
    })
    expect(plugin.manifest).toEqual(__dirname + "/absolute/path/manifest.json")
})

test("Config path", () => {
    let plugin = new ZATServerPlugin()
    expect(plugin.config).toEqual(__dirname + "/settings.yml")

    plugin = new ZATServerPlugin({
        config: "relative/path",
    })
    expect(plugin.config).toEqual(__dirname + "/relative/path")

    plugin = new ZATServerPlugin({
        config: __dirname + "/absolute/path",
    })
    expect(plugin.config).toEqual(__dirname + "/absolute/path")
})

test("Server start", async () => {
    await fs.mkdir(testdir)
    try {
        const manifest = path.join(testdir, "manifest.json")
        await fs.writeFile(manifest, "{}")
        const plugin = new ZATServerPlugin({ path: testdir })
        jest.spyOn(plugin, "watchFile").mockImplementation()

        // Start
        expect(plugin.server).toBeUndefined()
        plugin.apply(mockCompiler)
        await timeout(1000)
        expect(plugin.server).toBeDefined()

        // Cleanup
        await plugin.exit()
    } finally {
        await fs.rm(testdir, { recursive: true })
    }
})

test("Mutiple servers exit", async () => {
    await fs.mkdir(testdir)
    try {
        const manifest = path.join(testdir, "manifest.json")
        await fs.writeFile(manifest, "{}")
        const plugins = [5000, 6000, 7000].map((port) => {
            const server = new ZATServerPlugin({ path: testdir, port })
            server.apply(mockCompiler)
            return server
        })
        await timeout(1000)
        processExit.mockClear()
        await Promise.all(plugins.map((plugin) => plugin.exit()))
        expect(processExit).toHaveBeenCalledTimes(1)
    } finally {
        await fs.rm(testdir, { recursive: true })
    }
})

test("Manifest watcher", async () => {
    await fs.mkdir(testdir)
    try {
        const manifest = path.join(testdir, "manifest.json")
        await fs.writeFile(manifest, "{}")
        const plugin = new ZATServerPlugin({ path: testdir })

        // Start
        const start = jest.spyOn(plugin, "start").mockImplementation()
        plugin.apply(mockCompiler)
        await timeout(1000)

        // Change
        start.mockClear()
        await fs.writeFile(manifest, "{ }")
        await timeout(1000)
        expect(start).toHaveBeenCalled()

        // Rename
        const exit = jest.spyOn(plugin, "exit").mockImplementation()
        await fs.rename(manifest, manifest + "1")
        expect(exit).toHaveBeenCalled()

        // Cleanup
        exit.mockRestore()
        await plugin.exit()
    } finally {
        await fs.rm(testdir, { recursive: true })
    }
})

test("Config watcher", async () => {
    await fs.mkdir(testdir)
    try {
        const manifest = path.join(testdir, "manifest.json")
        await fs.writeFile(manifest, "{}")
        const config = path.join(testdir, "settings.yml")
        await fs.writeFile(config, "")
        const plugin = new ZATServerPlugin({ path: testdir, config })

        // Start
        const start = jest.spyOn(plugin, "start").mockImplementation()
        plugin.apply(mockCompiler)
        await timeout(1000)

        // Change
        start.mockClear()
        await fs.writeFile(config, " ")
        await timeout(1000)
        expect(start).toHaveBeenCalled()

        // Rename
        const exit = jest.spyOn(plugin, "exit").mockImplementation()
        await fs.rename(config, config + "1")
        expect(exit).toHaveBeenCalled()

        // Cleanup
        exit.mockRestore()
        await plugin.exit()
    } finally {
        await fs.rm(testdir, { recursive: true })
    }
})
