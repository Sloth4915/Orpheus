const devMode = false
let errorLogs = []
let logs = []
let completeLog = []

if (!devMode) {
    window.addEventListener("error", (e) => {
        //console.log("detected an error")
        let stack = 'stack'//new Error().stack.toString().split(/\r\n|\n/).map((a) => a.trim())
        logs.push(["EXCEPTION", e, stack])
        errorLogs.push(["EXCEPTION", e, stack])
    })
    window.addEventListener("unhandledrejection", (e) => {
        //console.log("detected an error")
        let stack = new Error().stack.toString().split(/\r\n|\n/).map((a) => a.trim())
        logs.push(["REJECTED PROMISE", e, stack])
        errorLogs.push(["REJECTED PROMISE", e, stack])
    })

    console.log = function () {
        let x = console.log
        return function (...params) {
            let stack = new Error().stack.toString().split(/\r\n|\n/).map((a) => a.trim())
            let immediateIssueLine = stack
            try {
                if (stack[0].length < 10) immediateIssueLine = stack[1].split(/scripts\//g)[1].trim()
                else immediateIssueLine = stack[0].split(/scripts\//g)[1].trim()
            } catch {}
            x(...params, immediateIssueLine)
            logs.push(["LOG", ...params, stack])
        }
    }()

    console.warn = function () {
        let x = console.warn
        return function (...params) {
            let stack = new Error().stack.toString().split(/\r\n|\n/).map((a) => a.trim())
            let immediateIssueLine = stack
            try {
                if (stack[0].length < 10) immediateIssueLine = stack[1].split(/scripts\//g)[1].trim()
                else immediateIssueLine = stack[0].split(/scripts\//g)[1].trim()
            } catch {}
            x(...params, immediateIssueLine)
            logs.push(["WARN", ...params, stack])
        }
    }()

    console.error = function () {
        let x = console.error
        return function (...params) {
            let stack = new Error().stack.toString().split(/\r\n|\n/).map((a) => a.trim())
            let immediateIssueLine = stack
            try {
                if (stack[0].length < 10) immediateIssueLine = stack[1].split(/scripts\//g)[1].trim()
                else immediateIssueLine = stack[0].split(/scripts\//g)[1].trim()
            } catch {}
            x(...params, immediateIssueLine)
            logs.push(["ERROR", ...params, stack])
            errorLogs.push(["ERROR", ...params, stack])
        }
    }()
}
