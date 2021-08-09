import { readFile, watch } from "fs"
import { join, isAbsolute } from "path"
import { spawn } from "child_process"
import type { FSWatcher } from "fs"
import type { ChildProcess } from "child_process"
import type { Compiler } from "webpack"

const abspath = (path: string) =>
    isAbsolute(path) ? path : join(process.cwd(), path)

class OptionError extends TypeError {
    constructor(key: string, type: { expected: string; received: string }) {
        super(
            `ZAT server option "${key}" must be of type ${type.expected}, got ${type.received}.`
        )
    }
}

class ZATServerWebpackPlugin {
    manifest = join(process.cwd(), "manifest.json")
    config = join(process.cwd(), "settings.yml")
    server?: ChildProcess
    watchers: Record<string, FSWatcher> = {}
    args: string[]

    constructor(options: Record<string, string | number | undefined> = {}) {
        this.args = Object.entries(options).flatMap(([key, value]) => {
            const arg = []

            if (key.length === 1) {
                arg.push("-" + key)
            } else {
                arg.push("--" + key.replace(/([A-Z])/g, "-$1").toLowerCase())
            }

            switch (typeof value) {
                case "string":
                    arg.push(value)
                    break
                case "number":
                    arg.push(value.toString())
                    break
                case "undefined":
                    break
                default:
                    throw new TypeError(
                        "ZAT server options can only be string, number, or undefined."
                    )
            }
            return arg
        })

        if ("path" in options) {
            if (typeof options.path !== "string") {
                throw new OptionError("path", {
                    expected: "string",
                    received: typeof options.path,
                })
            }
            this.manifest = join(abspath(options.path), "manifest.json")
        }

        if ("config" in options) {
            if (typeof options.config !== "string") {
                throw new OptionError("config", {
                    expected: "string",
                    received: typeof options.config,
                })
            }
            this.config = abspath(options.config)
        }

        process.on("exit", () => {
            this.stop()
        })
    }

    start() {
        this.server = spawn("zat", ["server", ...this.args])
        this.server.stdout?.pipe(process.stdout)
        this.server.stderr?.pipe(process.stderr)
    }

    stop() {
        this.server?.kill()
        for (const filepath in this.watchers) {
            this.watchers[filepath].close()
        }
    }

    apply(compiler: Compiler) {
        compiler.hooks.afterEmit.tap("ZAT Server", () => {
            if (!this.server) {
                this.start()
                this.watchFile(this.manifest, true)
                this.watchFile(this.config, false)
            }
        })
    }

    watchFile(filepath: string, required: boolean) {
        readFile(filepath, (error, buffer) => {
            if (error) {
                if (required) {
                    throw error
                } else {
                    return
                }
            }

            this.watchers[filepath]?.close()
            this.watchers[filepath] = watch(filepath, (eventType) => {
                switch (eventType) {
                    case "change":
                        readFile(filepath, (error, newBuffer) => {
                            if (!error && newBuffer?.compare(buffer)) {
                                buffer = newBuffer
                                this.server?.kill()
                                this.start()
                            }
                        })
                        break
                    case "rename":
                        console.log(
                            "ZAT server dependency file path changed, Webpack restart required."
                        )
                        this.stop()
                        break
                }
            })
        })
    }
}

export = ZATServerWebpackPlugin
