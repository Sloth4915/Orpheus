// TODO consider "use strict";

//#region Local Storage Keys
const YEAR = "scouting_4915_year"
const TBA_KEY = "scouting_4915_apikey"
const EVENT = "scouting_4915_event"
const DATA = "scouting_4915_data"
const MAPPING = "scouting_4915_mapping"
const THEME = "scouting_4915_theme"
const ENABLED_APIS = "scouting_4915_apis"
const SETTINGS = "scouting_4915_settings_general"
const WIDGETS = "scouting_4915_settings_widgets"
const TEAM_SAVES = "scouting_4915_settings_starignore"
const NOTES = "scouting_4915_settings_notes"
const SAVED_API_DATA = "scouting_4915_api_saved"
const LOCAL_STORAGE_KEYS = [YEAR, TBA_KEY, EVENT, DATA, MAPPING, THEME, ENABLED_APIS, SETTINGS, WIDGETS, TEAM_SAVES, NOTES]
//#endregion

//#region Variables
const MISSING_LOGO = "https://frc-cdn.firstinspires.org/eventweb_frc/ProgramLogos/FIRSTicon_RGB_withTM.png"

const toolName = "Orpheus"
const version = 0.1

let doingInitialSetup = false

let eventKey
let event_data
let uploadedData = {}
let team_data = {}
let api_data = {}
let tbaMatches = {}
let mapping

let theme

let starred
let ignored

let loading = 0

let showTeamIcons

let roundingDigits = 3
let rounding = Math.pow(10, roundingDigits)

let keyboardControls
let brieflyDisableKeyboard = false

let year

let tieValue = 0.5

let desmosColors
const desmosScriptSrc = "https://www.desmos.com/api/v1.10/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6"

let showNamesInTeamComments

let tbaKey
let usingTBA
let usingTBAMatches
let usingTBAMedia
let usingDesmos
let usingStatbotics

let projectorMode = false

let usingOffline = false
let starUnicode = String.fromCodePoint(9733)
let crossOutUnicode = "X"

let processedData

//#endregion

//#region Init Header Controls
let modalShowing = false
for (let el of document.querySelector("#top-controls").children) {
    if (el.tagName === "BUTTON" && el.classList.contains("dropdown-button")) {
        el.onclick = function() {
            for (let el of document.getElementsByClassName("top-control-dropdown"))
                el.close()
            let modal = document.querySelector(`dialog[for="${el.id}"]`)
            modal.show()
            modalShowing = false
            setTimeout(() => modalShowing = true, 0)
        }
    } else if (el.tagName === "DIALOG") {
        el.onclick = function() {
            modalShowing = false
            setTimeout(() => modalShowing = true, 0)
        }
        let inner = document.createElement("div")
        inner.innerHTML = el.innerHTML
        el.innerHTML = ""
        el.appendChild(inner)
    }
}

setHeaderControlsPositions()

function setHeaderControlsPositions() {
    for (let el of document.querySelector("#top-controls").children) {
        if (el.tagName === "DIALOG") {
            let button = document.querySelector("#"+el.getAttribute("for"))
            el.style.top = button.getBoundingClientRect().bottom + 4 + "px"
            el.style.left = button.getBoundingClientRect().left + 10 + "px"
        }
    }
}

document.addEventListener("click", () => {
    if (modalShowing) {
        for (let el of document.getElementsByClassName("top-control-dropdown"))
            el.close()
        modalShowing = false
    }
})

//#endregion

//#region API Key, Event Loading, Year setting
document.querySelector("#top-setapi").onclick = function() {
    let x = prompt("What is your TBA API key? 'get' to get it, leave blank to skip")
    if (x === "get") alert(tbaKey)
    else if (x === "clear") {
        localforage.removeItem(TBA_KEY)
        window.location.reload()
    }
    else if (x !== "") {
        localforage.setItem(TBA_KEY, x)
        window.location.reload()
    }
}
document.querySelector("#top-load-event").onclick = function() {
    let x = prompt("What event code do you want?")
    if (x === "get") alert(eventKey)
    else if (x === "clear") {
        localforage.removeItem(EVENT)
        window.location.reload()
    }
    else if (x !== "") {
        localforage.setItem(EVENT, x.toLowerCase())
        window.location.reload()
        clearSavedTeams()
    }

}
document.querySelector("#top-year").onclick = function() {
    let x = prompt("Change year").trim()
    if (x === "get") alert(year)
    else if (x !== "") {
        localforage.setItem(YEAR, x)
        window.location.reload()
        clearSavedTeams()
    }
}
document.querySelector("#top-clear-event").onclick = function() {
    clearSavedTeams()
    starred = []
    ignored = []
    usingStar = true
    usingIgnore = true
    setHeader()
}
function loadEvent() {
    loading++
    if (usingTBA) {
        load("event/" + year + eventKey + "/teams", function (data) {
            event_data = data
            for (let team of data) {
                // Todo - just replace all team["team_number"] with a variable you don't need to keep getting it 3 trillion times
                team_data[team["team_number"]] = {}
                team_data[team["team_number"]].Team_Number = team["team_number"]
                team_data[team["team_number"]].Name = team["nickname"]
                team_data[team["team_number"]].TBA = team
                team_data[team["team_number"]].TBA["matches"] = {}
                if (usingTBAMatches) {
                    loading++
                    load("team/frc" + team["team_number"] + "/event/" + year + eventKey + "/matches", function (data) {
                        loading--
                        checkLoading()
                        let matchesWon = 0
                        let matchesPlayed = 0
                        let fouls = 0
                        for (let match of data) {
                            let alliance = "blue"
                            if (match["alliances"]["blue"]["team_keys"].includes(team)) alliance = "red"

                            if (match["actual_time"] !== null)

                            if (match["alliances"]["blue"]["score"] !== -1) {
                                matchesPlayed++
                                fouls += match["score_breakdown"][alliance]["foulPoints"]
                                matchesWon += checkTeamWonMatch(match, team["team_number"])
                            }

                            if (match["comp_level"] === "qm") {
                                team_data[team["team_number"]].TBA["matches"][match["match_number"]] = match
                            }
                        }
                        team_data[team["team_number"]]["Matches Played"] = matchesPlayed
                        team_data[team["team_number"]]["Winrate"] = (matchesWon / matchesPlayed)
                        team_data[team["team_number"]]["Average Alliance Penalties"] = (fouls / matchesPlayed)
                    })
                }
                if (usingTBAMedia) {
                    loading++
                    load("team/frc" + team["team_number"] + "/media/" + year, function (data) {
                        loading--
                        checkLoading()
                        team_data[team["team_number"]].TBA.images = []

                        for (let x of data) {
                            if (x.type === "avatar") team_data[team["team_number"]].Icon = "data:image/png;base64," + x.details["base64Image"]
                            else if (x.type === "imgur") team_data[team["team_number"]].TBA.images.push({type: "image", src: x["direct_url"]})
                            else if (x.type === "youtube") team_data[team["team_number"]].TBA.images.push({type: "youtube", src: x["foreign_key"]})
                            else console.log("Unsupported media type: " + x.type + ". (Team " + team["team_number"] + ")")
                        }
                    })
                }
                if (usingStatbotics) {
                    loading++
                    loadOther("https://api.statbotics.io/v3/team_event/" + team["team_number"] + "/" + year + eventKey, function(data) {
                        team_data[team["team_number"]]["statbotics"] = data
                        team_data[team["team_number"]]["District Points"] = data["district_points"]
                        team_data[team["team_number"]]["EPA"] = data["epa"]["total_points"]["mean"]
                        team_data[team["team_number"]]["Auto EPA"] = data["epa"]["breakdown"]["auto_points"]
                        team_data[team["team_number"]]["Teleop EPA"] = data["epa"]["breakdown"]["teleop_points"]
                        team_data[team["team_number"]]["Endgame EPA"] = data["epa"]["breakdown"]["endgame_points"]
                        team_data[team["team_number"]]["Event Rank"] = data["record"]["qual"]["rank"]
                        loading--
                        checkLoading()
                    })
                }
            }
            loading--
            checkLoading()
        })
        if (usingTBAMatches) {
            load("event/" + year + eventKey + "/matches", function (data) {
                for (let m of data) {
                    if (m["comp_level"] === "qm") tbaMatches[m["match_number"]] = m
                }
            })
        }
    }
    else {
        loading--
        checkLoading()
        processData()
    }
}
function checkTeamWonMatch(match, team) {
    team = "frc" + team
    if (match["winning_alliance"] === "") return tieValue
    let alliance = "red"
    if (match["alliances"]["blue"]["team_keys"].includes(team)) alliance = "blue"
    return alliance === match["winning_alliance"]
}
//#endregion

//#region Data and Mappings
// Import mapping button
document.querySelector("#top-mapping").onclick = function() {
    loadFile(".json", (result) => {
        mapping = JSON.parse(result)
        localforage.setItem(MAPPING, mapping)
        //columns = JSON.parse(JSON.stringify(availableColumns))
        processData()
    })
}

math.import({
    equal: function(a,b) {
        return a == b
    }
}, {override: true})

let internalMapping = {
    "number": {
        "alias": "Team Number"
    }
}

function findMatchData(schema, team, match) {
    for (let x of uploadedData[schema])
        if (match == x[mapping[schema]["match_key"]] && team == getTeam(schema, x[mapping[schema]["team_key"]])) return x
    return {}
}
function getTeam(schema, team) {
    if (!isNaN(parseInt(team))) {
        return (parseInt(team))
    }
    else if (typeof team == "string") {
        team = team.toLowerCase()

        //frc4915, frc2910, etc
        if (team.startsWith("frc") && !isNaN(parseInt(team.slice(3))))
            return (parseInt(team.slice(3)))

        // Red 1, Blue 2, etc.
        else if ((team.replaceAll(/\s/g, "").startsWith("red") || team.replaceAll(/\s/g, "").startsWith("blue")) && mapping[schema]["input_format"] === "match")
            return (parseInt(tbaMatches[datum[mapping[schema]["match_key"]]]["alliances"]["red"]["team_keys"][team.slice(team.indexOf(/\s/g)) - 1].slice(3)))

        // Spartronics, Jack in the Bot, etc
        else {
            for (let eventTeam of event_data)
                if (eventTeam["nickname"] === team)
                    return (eventTeam["team_number"])
        }
    }
    console.error("Couldn't find team " + team + " in schema " + schema)
    return -1
}
function processData() {
    let dataOut = {}

    // Get a list of teams
    let teams = new Set()
    for (let schema of Object.keys(mapping)) {
        for (let datum of uploadedData[schema]) {
            teams.add(getTeam(schema, datum[mapping[schema]["team_key"]]))
        }
    }

    function handleData(schema, datumMapping, context) {
        let out = {}
        console.log(schema, datumMapping, context)
        for (let x of Object.keys(datumMapping)) {
            if (datumMapping[x]["type"]) { // If has type, then we can evaluate

                if (datumMapping[x]["type"] === "comment") {
                    let comments = {}
                    for (let team of teams) comments[team] = {}

                    if (mapping[schema]["input_format"] === "match") {
                        for (let match of uploadedData[schema]) {
                            let team = getTeam(schema, match[mapping[schema]["team_key"]])
                            let matchNum = match[mapping[schema]["match_key"]]
                            comments[team][matchNum] = {
                                "comment": match[datumMapping[x]["key"]]
                            }
                            if (datumMapping[x]["scouter_key"])
                                comments[team][matchNum]["scouter"] = match[datumMapping[x]["scouter_key"]]
                        }
                    }
                    // todo team comment processing

                    out[x] = comments
                }
                else if (datumMapping[x]["type"] === "ratio" || datumMapping[x]["type"] === "number" || datumMapping[x]["type"] === "accuracy" || datumMapping[x]["type"] === "text") {
                    let data = {}
                    for (let team of teams) data[team] = {}

                    if (mapping[schema]["input_format"] === "match") {
                        for (let match of uploadedData[schema]) {
                            let team = getTeam(schema, match[mapping[schema]["team_key"]])
                            let matchNum = match[mapping[schema]["match_key"]]

                            let otherBots = {
                                "red 1": parseInt(tbaMatches[matchNum]["alliances"]["red"]["team_keys"][0].slice(3)),
                                "red 2": parseInt(tbaMatches[matchNum]["alliances"]["red"]["team_keys"][1].slice(3)),
                                "red 3": parseInt(tbaMatches[matchNum]["alliances"]["red"]["team_keys"][2].slice(3)),
                                "blue 1": parseInt(tbaMatches[matchNum]["alliances"]["blue"]["team_keys"][0].slice(3)),
                                "blue 2": parseInt(tbaMatches[matchNum]["alliances"]["blue"]["team_keys"][1].slice(3)),
                                "blue 3": parseInt(tbaMatches[matchNum]["alliances"]["blue"]["team_keys"][2].slice(3))
                            }
                            let alliance = tbaMatches[matchNum]["alliances"]["red"]["team_keys"].includes("frc"+team) ? "red" : "blue"
                            let position = tbaMatches[matchNum]["alliances"][alliance]["team_keys"].indexOf("frc"+team) + 1

                            otherBots["other 1"] = parseInt(tbaMatches[matchNum]["alliances"][alliance]["team_keys"][((position + 1) % 3)].slice(3))
                            otherBots["other 2"] = parseInt(tbaMatches[matchNum]["alliances"][alliance]["team_keys"][((position) % 3)].slice(3))

                            let evalContext = Object.assign({
                                "match": matchNum,
                                "team": team,
                                "data": match,
                                "tba": tbaMatches[matchNum],
                                "alliance": alliance,
                                "position": position,
                                "functions": mapping[schema]["functions"]
                            }, context, otherBots)

                            if (datumMapping[x]["type"] === "number" || datumMapping[x]["type"] === "text") data[team][matchNum] = evaluate(datumMapping[x]["formula"], schema, evalContext)
                            if (datumMapping[x]["type"] === "ratio") {
                                let num = evaluate(datumMapping[x]["numerator"], schema, evalContext)
                                let den = evaluate(datumMapping[x]["denominator"], schema, evalContext)
                                data[team][matchNum] = {
                                    "numerator": num,
                                    "denominator": den,
                                    "ratio": num/den
                                }
                            }
                            if (datumMapping[x]["type"] === "accuracy") {
                                let fromData = evaluate(datumMapping[x]["formula"], schema, evalContext)
                                let expected = evaluate(datumMapping[x]["expected"], schema, evalContext)

                                data[team][matchNum] = {
                                    "data": fromData,
                                    "expected": expected,
                                    "difference": fromData - expected,
                                }
                            }
                        }

                        // Summarize
                        // average/mean/geomean/median/mode/sum/min/max/ratio
                        if (datumMapping[x]["table"]) { // Only summarize if table is enabled
                            let summarize = datumMapping[x]["summarize"] ? datumMapping[x]["summarize"].toLowerCase() : (datumMapping[x]["type"] == "ratio" ? "ratio" : "mean")
                            // If no summarization is included, set it to mean by default, unless it is a ratio type, in which case leave it as ratio.

                            for (let team of teams) {
                                if (summarize === "average" || summarize === "mean") {
                                    let val = 0
                                    for (let match of Object.keys(data[team])) {
                                        if (datumMapping[x]["type"] === "number") val += data[team][match]
                                        if (datumMapping[x]["type"] === "ratio") val += data[team][match]["ratio"]
                                        if (datumMapping[x]["type"] === "accuracy") val += Math.abs(data[team][match]["difference"])
                                    }
                                    val /= Object.keys(data[team]).length
                                    data[team]["summarized"] = val
                                } else if (summarize === "min") {
                                    data[team]["summarized"] = Math.min(...Object.values(data[team]))
                                } else if (summarize === "max") {
                                    data[team]["summarized"] = Math.max(...Object.values(data[team]))
                                }
                                // Todo geomean, median, mode, sum, ratio
                            }
                        }
                    } else { // Input type is team
                        for (let teamData of uploadedData[schema]) {
                            let team = getTeam(schema, teamData[mapping[schema]["team_key"]])

                            let evalContext = Object.assign({
                                "team": team,
                                "data": teamData,
                                "functions": mapping[schema]["functions"]
                            }, context)

                            if (datumMapping[x]["type"] === "number" || datumMapping[x]["type"] === "text") data[team] = evaluate(datumMapping[x]["formula"], schema, evalContext)
                            if (datumMapping[x]["type"] === "ratio") {
                                let num = evaluate(datumMapping[x]["numerator"], schema, evalContext)
                                let den = evaluate(datumMapping[x]["denominator"], schema, evalContext)
                                data[team] = {
                                    "numerator": num,
                                    "denominator": den,
                                    "ratio": num/den
                                }
                            }
                            if (datumMapping[x]["type"] === "accuracy") {
                                let fromData = evaluate(datumMapping[x]["formula"], schema, evalContext)
                                let expected = evaluate(datumMapping[x]["expected"], schema, evalContext)

                                data[team] = {
                                    "data": fromData,
                                    "expected": expected,
                                    "difference": fromData - expected,
                                }
                            }
                        }

                        // TODO: this can all be simplified because input type team and input type match use largely the same logic, just with a different evalContext and a different output
                    }

                    out[x] = data
                }
                else if (datumMapping[x]["type"] === "media") {
                    let media = {}
                    for (let team of teams) media[team] = []
                    for (let i of uploadedData[schema]) {
                        let team = getTeam(schema, i[mapping[schema]["team_key"]])
                        if (typeof datumMapping[x]["key"] === "string") {
                            if (i[datumMapping[x]["key"]].trim() !== "")
                                media[team].push(i[datumMapping[x]["key"]])
                        }
                        else {
                            for (let key of datumMapping[x]["key"])
                                if (i[key].trim() !== "")
                                    media[team].push(i[key])
                        }
                    }
                    out[x] = media
                }
                else console.error("Unexpected datum type " + datumMapping[x]["type"] + " for " + x)
            } else {
                out[x] = handleData(schema, datumMapping[x], context)
            }
        }
        return out
    }

    // dataOut
    for (let schema of Object.keys(mapping)) {
        let inFormat = mapping[schema]["input_format"] ? mapping[schema]["input_format"] : "match"

        let constants = {}
        if (mapping[schema]["constants"])
            for (let x of Object.keys(mapping[schema]["constants"])) {
                constants[x] = math.evaluate("" + mapping[schema]["constants"][x])
            }

        dataOut[schema] = {
            alias: mapping[schema]["alias"] ? mapping[schema]["alias"] : schema,
            constants,
            data: handleData(schema, mapping[schema]["data"], {"constants": constants})
        }
    }

    teams = [...teams].sort((a,b) => a - b)
    console.log(teams)
    console.log(dataOut)

    processedData = dataOut

    let orpheus = {"data": {
        "number": {}
    }}
    for (let team of teams) {
        orpheus["data"]["number"][team] = team
    }
    processedData["orpheus"] = orpheus

    table.addColumn(["orpheus`number", "match`Scoring`Coral Scored", "match`tba climb"])
    table.addTeam(teams)
    table.addColumn("pit`Drivetrain")
}

function evaluate(expression, schema, context) {

    function replaceConstants(exp, params = {}) {
        exp = (""+exp).replaceAll("#team#", context.team)
                      .replaceAll("#alliance#", context.alliance)
                      .replaceAll("#match#", context.match)
                      .replaceAll("#position#", context.position)

        while (exp.includes("[")) {
            let tag = exp.substring(exp.indexOf("["),exp.indexOf("]") + 1)
            let search = exp.substring(exp.indexOf("[") + 1,exp.indexOf("]")).split(".")
            let val = 0

            if (search.length === 1) {
                if (params[search[0]]) val = params[search[0]]
                else if (context.constants[search[0]]) val = context.constants[search[0]]
                else val = context.data[search[0]]
            } else if (search[0].toLowerCase() === "tba") {
                val = context.tba["score_breakdown"]
                let specifier = search.slice(1)
                if (!(specifier[0] === 'red' || specifier[0] === 'blue')) specifier.unshift(context.alliance)
                for (let i of specifier)
                    val = val[i]
            } else {
                if (["red 1", "red 2", "red 3", "blue 1", "blue 2", "blue 3", "other 1", "other 2"].includes(search[0].toLowerCase()))
                    val = findMatchData(schema, context[search[0].toLowerCase()], context.match)
                else val = context.data

                let specifier = search.slice(1)
                for (let i of specifier)
                    val = val[i]
            }

            if (val === undefined || val === "") val = 0
            if (typeof val === "string") val = `"${val}"`
            exp = exp.replace(tag, val)
        }

        return exp
    }

    let functions = {}
    if (context["functions"])
        for (let f of Object.keys(context["functions"]))
            functions[f] = function(...params) {
                let parameters = {}
                for (let x in (context["functions"][f]["params"])) {
                    parameters[(context["functions"][f]["params"])[x]] = params[x]
                }
                return math.evaluate(replaceConstants(context["functions"][f]["returns"], parameters))
            }

    let result = math.evaluate(replaceConstants(expression), functions)

    return result
}

function dataButtons() {
    let data = document.querySelector("#top-data-buttons")

    if (uploadedData == undefined) uploadedData = {}

    function uploadData(schema) {
        loadFile(".csv,.json", (result, filetype) => {
            let data
            filetype = filetype == "csv" || filetype == "json" ? filetype : prompt("What is the filetype? (csv/json)").toLowerCase().trim()
            if (filetype === "csv") data = csvToJson(result) // Converts CSV to JSON
            else if (filetype === "json") data = JSON.parse(result) // Parses json
            else return
            console.log(data)
            uploadedData[schema] = data
            localforage.setItem(DATA, uploadedData)
            document.querySelector("#top-download-" + schema).disabled = false
            delete maintainedTeamPageSettings["graph"]
            saveGeneralSettings()
            if (doingInitialSetup) window.location.reload()
            if (mapping !== undefined) processData()
        })
    }

    for (let schema of Object.keys(mapping)) {
        if (!uploadedData[schema]) uploadedData[schema] = {}

        let uploadButton = document.createElement("button")
        uploadButton.innerText = "Upload " + (mapping[schema]["alias"] ? mapping[schema]["alias"] : schema)
        uploadButton.addEventListener("click", () => uploadData(schema))
        data.appendChild(uploadButton)

        let downloadButton = document.createElement("button")
        downloadButton.innerText = "Download saved " + (mapping[schema]["alias"] ? mapping[schema]["alias"] : schema)
        downloadButton.id = "top-download-" + schema
        downloadButton.disabled = Object.keys(uploadedData[schema]) === undefined
        downloadButton.addEventListener("click", () => download((mapping[schema]["alias"] ? mapping[schema]["alias"] : schema) + ".json", JSON.stringify(uploadedData[schema])))
        data.appendChild(downloadButton)

        let dropdownPause = document.createElement("div")
        dropdownPause.className = "#dropdown-pause"
        data.appendChild(dropdownPause)
    }
}

function csvToJson(csv) {
    let rawFields = csv.split("\n")[0]

    let fields = []
    let inQuote = false
    let current = ""
    for (let char of rawFields) {
        if (char === '"') inQuote = !inQuote
        else if (char === ',' && !inQuote) {
            fields.push(current.trim())
            current = ""
        } else current = current + char
    }
    fields.push(current)

    let str = ""
    inQuote = false
    for (let substring of csv.split("\n").slice(1)) {
        for (let char of substring) {
            str = str + char
            if (char === '"') inQuote = !inQuote
        }
        if (!inQuote) str = str + ","
        str = str + "\n"
        //inQuote = false
    }

    let json = []
    current = ""
    let currentMatch = {}
    inQuote = false
    for (let char of str) {
        if (char === '"') inQuote = !inQuote
        if (char === ',' && !inQuote) {
            current = current.trim()
            if (current.startsWith('"')) current = current.substring(1)
            if (current.endsWith('"')) current = current.substring(0, current.length - 1)
            current = current.replaceAll('""', '"').trim()
            if (!isNaN(parseFloat(current.replaceAll(",", "")))) current = parseFloat(current.replaceAll(",", ""))
            currentMatch[fields[Object.keys(currentMatch).length]] = current

            current = ""
            if (Object.keys(currentMatch).length === fields.length) {
                json.push(currentMatch)
                currentMatch = {}
            }
        } else current = current + char
    }

    return json
}

// Mapping Download
document.querySelector("#top-mapping-download").onclick = () => download("mapping.json", JSON.stringify(mapping))

document.querySelector("#top-rounding").onclick = function() {
    let x = prompt("Round to how many digits?")
    x = parseInt(x)
    if (isNaN(x)) return
    roundingDigits = Math.max(Math.min(x, 16), 0)
    rounding = Math.pow(10, roundingDigits)
    saveGeneralSettings()
    setRoundingEl()
    regenTable()
}
function setRoundingEl() {
    document.querySelector("#top-rounding").innerText = "Rounding: " + (roundingDigits === 0 ? "Integer" : (roundingDigits === 16 ? "Float" : roundingDigits + " digits"))
}

document.querySelector("#top-clear-files").addEventListener("click", () => {
    localforage.removeItem(DATA)
    localforage.removeItem(MAPPING)
    window.location.reload()
})

//#endregion

//#region Theme, Projector Mode
function changeThemeTo(to) {
    let root = document.querySelector(":root").classList
    root.remove("dark")
    root.remove("spartronics_theme")
    theme = to
    if (theme === "dark") root.add("dark")
    if (theme === "4915") root.add("spartronics_theme")
    localforage.setItem(THEME, theme)
}
// Theme toggle button
document.querySelector("#top-theme").onclick = function() {
    changeThemeTo(theme == "light" ? "dark" : theme == "dark" ? "4915" : "light")
}
document.querySelector("#top-projector").addEventListener("click", () => {
    projectorMode = !projectorMode
    setProjectorModeSheet()
})

function setProjectorModeSheet() {
    document.querySelector("#top-projector").innerText = "Projector Mode: " + (projectorMode ? "Enabled" : "Disabled")

    if (projectorMode) document.querySelector(":root").classList.add("projector")
    else document.querySelector(":root").classList.remove("projector")

    setTimeout(setHeaderControlsPositions, 1000)
    setGraphColors()
}

function setGraphColors() {
    if (projectorMode)
        desmosColors = ["#ff0000","#00ff00","#0000ff","#000000","#dd00ff","#00ffee"]
    else
        desmosColors = [Desmos.Colors.RED, Desmos.Colors.BLUE, Desmos.Colors.GREEN, Desmos.Colors.PURPLE, Desmos.Colors.ORANGE, Desmos.Colors.BLACK]
}
//#endregion

//#region Column edit panel, Keyboard Controls
let controlPressed = false

let columnEditOpen = false

function resetColumns() {
    setColumnOptions()
    columns = JSON.parse(JSON.stringify(availableColumns))
    selectedSort = columns[0]
    showTeamIcons = usingTBAMedia
    saveGeneralSettings()
    saveColumns()
    setHeader()
    if (columnEditOpen) columnEditPanel()
}

document.querySelector("#top-keyboard").onclick = function() {
    keyboardControls = !keyboardControls
    document.querySelector("#top-keyboard").innerText = "Keyboard Controls: " + (keyboardControls ? "Enabled" : "Disabled")
    saveGeneralSettings()
}
document.addEventListener("keydown", (e) => {
    if (!keyboardControls || brieflyDisableKeyboard) return
})
document.addEventListener("keyup", (e) => {
    if (!keyboardControls || brieflyDisableKeyboard) return
    let key = e.key.toLowerCase()
    if (key === "control") controlPressed = false
})
document.querySelector("#top-column-reset").addEventListener("click", resetColumns)
document.querySelector("#top-columns").addEventListener("click", () => {
    columnEditOpen = !columnEditOpen
    document.querySelector(".edit-columns").classList.toggle("hidden")
    if (columnEditOpen) columnEditPanel()
})

function columnEditPanel() {
    setColumnOptions()

    let columnPanel = document.querySelector(".edit-columns")
    columnPanel.style.left = (window.innerWidth * .2) + "px"
    columnPanel.style.top = (window.innerHeight * .3) + "px"
    columnPanel.innerHTML = ""

    let currentColumnsTitle = document.createElement("div")
    currentColumnsTitle.className = "edit-columns-title"
    currentColumnsTitle.innerText = "Table"
    columnPanel.appendChild(currentColumnsTitle)

    let currentColumns = document.createElement("div")
    currentColumns.className = "edit-columns-list"
    columnPanel.appendChild(currentColumns)

    // https://stackoverflow.com/questions/74335612/drag-and-drop-when-using-flex-wrap
    currentColumns.addEventListener("dragover", (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(currentColumns, e.clientX, e.clientY);
        const draggable = document.querySelector(".dragging");
        if (afterElement == null) {
            currentColumns.appendChild(draggable);
        } else {
            currentColumns.insertBefore(draggable, afterElement);
        }
    })

    let unEnabledColumnsTitle = document.createElement("div")
    unEnabledColumnsTitle.className = "edit-columns-title"
    unEnabledColumnsTitle.innerText = "Unused Columns"
    columnPanel.appendChild(unEnabledColumnsTitle)

    let unEnabledColumns = document.createElement("div")
    unEnabledColumns.className = "edit-columns-list"
    columnPanel.appendChild(unEnabledColumns)
    unEnabledColumns.addEventListener("dragover", (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(unEnabledColumns, e.clientX, e.clientY);
        const draggable = document.querySelector(".dragging");
        if (afterElement == null) {
            unEnabledColumns.appendChild(draggable);
        } else {
            unEnabledColumns.insertBefore(draggable, afterElement);
        }
    })

    function getDragAfterElement(container, x, y) {
        const draggableElements = [
            ...container.querySelectorAll(".draggable:not(.dragging)")
        ];
        return draggableElements.reduce(
            (closest, child, index) => {
                const box = child.getBoundingClientRect();
                const nextBox = draggableElements[index + 1] && draggableElements[index + 1].getBoundingClientRect();
                const inRow = y - box.bottom <= 0 && y - box.top >= 0; // check if this is in the same row
                const offset = x - (box.left + box.width / 2);
                if (inRow) {
                    if (offset < 0 && offset > closest.offset) {
                        return {
                            offset: offset,
                            element: child
                        };
                    } else {
                        if ( // handle row ends,
                            nextBox && // there is a box after this one.
                            y - nextBox.top <= 0 && // the next is in a new row
                            closest.offset === Number.NEGATIVE_INFINITY // we didn't find a fit in the current row.
                        ) {
                            return {
                                offset: 0,
                                element: draggableElements[index + 1]
                            };
                        }
                        return closest;
                    }
                } else {
                    return closest;
                }
            }, {
                offset: Number.NEGATIVE_INFINITY
            }
        ).element;
    }

    for (let column of availableColumns) {
        let columnEl = document.createElement("div")
        columnEl.className = "edit-column draggable"
        columnEl.innerText = column.name.replaceAll("_", " ")
        columnEl.draggable = true
        columnEl.setAttribute("data-column-name", column.name)

        let enabled = false
        for (let x of columns)
            if (column.name === x.name) enabled = true
        if (enabled) currentColumns.appendChild(columnEl)
        else unEnabledColumns.appendChild(columnEl)

        columnEl.addEventListener("dragstart", () => {
            columnEl.classList.add("dragging");
        });
        columnEl.addEventListener("dragend", () => {
            columnEl.classList.remove("dragging");
            updateColumns()
        });
    }

    function updateColumns() {
        let newColumns = []
        for (let child of currentColumns.children) {
            for (let x of availableColumns)
                if (x.name === child.getAttribute("data-column-name")) {
                    let size = x.size
                    for (let col of columns) {
                        if (col.name === x.name) size = col.size
                    }
                    newColumns.push(x)
                    newColumns[newColumns.length-1].size = size
                }
        }
        columns = newColumns
        setHeader()
        saveColumns()
    }

    let iconsDiv = document.createElement("div")
    iconsDiv.className = "edit-column-buttons"
    if (usingTBAMedia)
        columnPanel.appendChild(iconsDiv)

    let iconBox = document.createElement("input")
    iconBox.type = "checkbox"
    iconBox.checked = showTeamIcons
    iconBox.id = "edit-column-icons-checkbox"
    iconBox.addEventListener("change", () => {
        showTeamIcons = iconBox.checked
        saveGeneralSettings()
        setHeader()
    })
    iconsDiv.appendChild(iconBox)

    let iconLabel = document.createElement("label")
    iconLabel.setAttribute("for", "edit-column-icons-checkbox")
    iconLabel.innerText = "Show team icons"
    iconsDiv.appendChild(iconLabel)

    let buttons = document.createElement("div")
    buttons.className = "edit-column-buttons"
    columnPanel.appendChild(buttons)

    let resetButton = document.createElement("button")
    resetButton.innerText = "Enable All"
    resetButton.addEventListener("click", () => {
        resetColumns()
        columnEditPanel()
        saveColumns()
    })
    buttons.appendChild(resetButton)

    let hideAll = document.createElement("button")
    hideAll.innerText = "Hide All"
    hideAll.addEventListener("click", () => {
        columns = []
        showTeamIcons = false
        columnEditPanel()
        setHeader()
        saveColumns()
    })
    buttons.appendChild(hideAll)

    let close = document.createElement("button")
    close.innerText = "Close"
    close.addEventListener("click", () => {
        columnEditOpen = false
        columnPanel.classList.add("hidden")
    })
    buttons.appendChild(close)
}

//#endregion

//#region Sorting, Stars, Ignore
let sortedTeams = []
function sortTeams() {
    if (columns.length === 0) return
    if (selectedSort.display === "string") {
        let arr = []
        let values = {}
        for (let i of Object.keys(team_data)) {
            arr.push(i)
            values[i] = (""+team_data[i][selectedSort.name]).toString().toLowerCase()
        }
        arr.sort(function(a, b) {
            if (values[a] < values[b]) return -1
            if (values[a] > values[b]) return 1
            return 0
        })
        sortedTeams = arr
    } else { // Number
        let arr = []
        for (let i of Object.keys(team_data)) {
            arr.push(i)
        }
        arr.sort(function(a, b) {
            if (isNaN(team_data[a][selectedSort.name]) && isNaN(team_data[b][selectedSort.name])) return 0
            if (isNaN(team_data[a][selectedSort.name])) return -1
            if (isNaN(team_data[b][selectedSort.name])) return 1
            return team_data[a][selectedSort.name] - team_data[b][selectedSort.name]
        })
        sortedTeams = arr
    }
}

function sort(team) {
    let starOffset = ((starred.includes(team) && usingStar) ? -Math.pow(10,9) : 0)
    let ignoreOffset = ((ignored.includes(team) && usingIgnore) ? Math.pow(10,9) : 0)
    let index = sortedTeams.indexOf(team)
    if (sortDirection !== -1) index = 10000 - index
    return ignoreOffset + starOffset + (index)
}
function changeSort(to) {
    if (selectedSort === to) sortDirection *= -1
    else {
        selectedSort = to
        sortDirection = 1
    }

    for (let el of document.getElementsByClassName("highlighted")) el.classList.remove("highlighted")
    for (let el of document.getElementsByClassName("top")) el.classList.remove("top")
    for (let el of document.getElementsByClassName("bottom")) el.classList.remove("bottom")

    document.querySelector("#select_" + to.name.replaceAll(/\W/g,"")).classList.add("highlighted")
    if (sortDirection === 1) document.querySelector("#select_" + to.name.replaceAll(/\W/g,"")).classList.add("top")
    if (sortDirection === -1) document.querySelector("#select_" + to.name.replaceAll(/\W/g,"")).classList.add("bottom")

    regenTable()
}
function star(i) {
    set_star(i, !starred.includes(i))
}
function star_toggle() {
    usingStar = !usingStar
    document.querySelector("#select_star").classList.toggle("filled")
    regenTable()
    saveTeams()
}
function set_star(team, to, regen=true) {
    if (starred.includes(team)) starred.splice(starred.indexOf(team), 1)
    if (to) {
        starred.push(team)
        set_ignore(team, false)
    }
    if (regen) regenTable()
    saveTeams()
    setStarbook()
}
function ignore(i) {
    set_ignore(i, !ignored.includes(i))
}
function ignore_toggle() {
    usingIgnore = !usingIgnore
    document.querySelector("#select_ignore").classList.toggle("filled")
    regenTable()
    saveTeams()
    setStarbook()
}
function set_ignore(team, to, regen=true) {
    if (ignored.includes(team)) ignored.splice(ignored.indexOf(team), 1)
    if (to) {
        ignored.push(team)
        set_star(team, false)
    }
    if (regen) regenTable()
    saveTeams()
}

document.querySelector("#top-show-hide-ignored").addEventListener("click", () => {
    showIgnoredTeams = !showIgnoredTeams
    document.querySelector("top-show-hide-ignored").innerText = "Ignored Teams: " + (showIgnoredTeams ? "Shown" : "Hidden")
    regenTable()
    saveGeneralSettings()
})

//#endregion

//#region File and API loading functions (+ download, API Toggles)
// Loads data from TheBlueAlliance
async function load(sub, onload) {
    let url = (`https://www.thebluealliance.com/api/v3/${sub}?X-TBA-Auth-Key=${tbaKey}`)
    if (usingOffline) {
        onload(api_data[url])
        return api_data[url]
    }

    loading++
    await fetch(url).then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok')
        }
        loading--
        checkLoading()
        return response.json()
    }).then(data => {
        onload(data)
        api_data[url] = data
        saveAPIData()
    })
}
async function loadOther(url, onload) {
    if (usingOffline) {
        onload(api_data[url])
        return api_data[url]
    }

    loading++
    await fetch(url).then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok')
        }
        loading--
        checkLoading()
        return response.json()
    }).then(data => {
        onload(data)
        api_data[url] = data
        saveAPIData()
    })
}
function checkLoading() {
    if (loading === 0) {
        document.querySelector("#loading").className = "hidden"
        if (mapping !== undefined) processData()
    } else {
        document.querySelector("#loading").className = ""
        document.querySelector("#loading").innerHTML = "Loading..."
    }
}
function loadFile(accept, listener) {
    let fileInput = document.createElement("input")
    fileInput.type = "file"
    fileInput.accept = accept
    fileInput.addEventListener("change", (e) => {
        const reader = new FileReader()
        reader.onload = (loadEvent) => {
            listener(loadEvent.target.result, filename.split('.').pop().toLowerCase())
        }
        let filename = e.target.files[0].name
        reader.readAsText(e.target.files[0])
    })
    fileInput.click()
}
function download(filename, text) {
    let el = document.createElement("a")
    el.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(text))
    el.setAttribute("download", filename)
    //document.appendChild(el)
    el.click()
    //document.removeChild(el)
}

document.querySelector("#top-toggle-use-allapi").addEventListener("click", () => {
    usingTBAMedia = usingTBAMatches = usingTBA = usingDesmos = usingStatbotics = true
    setEnabledAPIS()
})
document.querySelector("#top-toggle-use-noneapi").addEventListener("click", () => {
    usingTBAMedia = usingTBAMatches = usingTBA = usingDesmos = usingStatbotics = false
    setEnabledAPIS()
})
document.querySelector("#top-toggle-use-tbaevent").addEventListener("click", () => {
    usingTBA = !usingTBA
    setEnabledAPIS()
})
document.querySelector("#top-toggle-use-tbamatch").addEventListener("click", () => {
    usingTBAMatches = !usingTBAMatches
    setEnabledAPIS()
})
document.querySelector("#top-toggle-use-tbamedia").addEventListener("click", () => {
    usingTBAMedia = !usingTBAMedia
    setEnabledAPIS()
})
document.querySelector("#top-toggle-use-desmos").addEventListener("click", () => {
    usingDesmos = !usingDesmos
    setEnabledAPIS()
})
document.querySelector("#top-toggle-use-statbotics").addEventListener("click", () => {
    usingStatbotics = !usingStatbotics
    setEnabledAPIS()
})

// Saves enabled apis
function setEnabledAPIS() {
    localforage.setItem(ENABLED_APIS, {
        tbaevent: usingTBA,
        tbamatch: usingTBAMatches,
        tbamedia: usingTBAMedia,
        desmos: usingDesmos,
        statbotics: usingStatbotics
    })
    location.reload()
}
//#endregion

//#region Context menu (right click menu)
document.addEventListener("contextmenu", (e) => {
    let contextMenu = document.querySelector(".context-menu")

    if (contextMenu.contains(e.target) || controlPressed) { // If right clicking on context menu, open browser context menu
        closeContextMenu()
        controlPressed = false // Opening context menu means the keyup event never happens so this fixes that
        return
    }
    else e.preventDefault()

    contextMenu.style.left = e.pageX + "px"
    contextMenu.style.top = e.pageY + "px"
    contextMenu.style.zIndex = document.querySelector(".sticky-header").contains(e.target) ? "10000" : "999"
    contextMenu.removeAttribute("hidden")
    contextMenu.removeAttribute("empty")

    let options = document.querySelector(".context-menu-options")
    while (options.childElementCount > 0) options.children[0].remove()

    function optionEl(name, action) {
        let option = document.createElement("button")
        option.className = "context-option"
        option.innerText = name
        option.addEventListener("click", () => {
            action()
        })
        options.appendChild(option)
    }

    let context = e.target.getAttribute("data-context")
})

document.addEventListener("click", closeContextMenu)
document.addEventListener("scroll", closeContextMenu)

function closeContextMenu() {
    document.querySelector(".context-menu").setAttribute("hidden", "hidden")
    document.querySelector(".context-menu").removeAttribute("empty")
}
//#endregion

//#region Save Settings, Load Config File, Credits Page
function saveGeneralSettings() {
    localforage.setItem(SETTINGS, {
        "keyboardControls": keyboardControls,
        "showNamesInTeamComments": showNamesInTeamComments,
        "showIgnoredTeams": showIgnoredTeams,
        "rounding": roundingDigits,
        "teamPageSettings": maintainedTeamPageSettings,
        "graphSettings": graphSettings,
        "showTeamIcons": showTeamIcons,
        "robotViewScope": robotViewScope
    })
}
function saveTeams() {
    localforage.setItem(TEAM_SAVES, {
        "starred": starred,
        "ignored": ignored,
        "usingStar": usingStar,
        "usingIgnore": usingIgnore
    })
}
function clearSavedTeams() {
    localforage.setItem(TEAM_SAVES, {
        "starred": [],
        "ignored": [],
        "usingStar": true,
        "usingIgnore": true,
    })
}
function saveColumns() {
    localforage.setItem(COLUMNS, columns)
}
function saveAPIData() {
    api_data["lastSaved"] = new Date().toLocaleString([], {year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'})
    api_data["apis"] = {
        tbaevent: usingTBA,
        tbamatch: usingTBAMatches,
        tbamedia: usingTBAMedia,
        desmos: false,
        statbotics: usingStatbotics
    }
    document.querySelector("#top-last-saved-apis").innerText = "Last Saved for offline use: \n" + api_data["lastSaved"]

    localforage.setItem(SAVED_API_DATA, api_data)
}

function exportSettings() {
    let notesOpen = notes.open
    notes.open = false
    let data = {
        general: {
            "keyboardControls": keyboardControls,
            "showNamesInTeamComments": showNamesInTeamComments,
            "showIgnoredTeams": showIgnoredTeams,
            "rounding": roundingDigits,
            "teamPageSettings": maintainedTeamPageSettings,
            "graphSettings": graphSettings,
            "showTeamIcons": showTeamIcons,
            "robotViewScope": robotViewScope
        },
        team: {
            "starred": starred,
            "ignored": ignored,
            "usingStar": usingStar,
            "usingIgnore": usingIgnore
        },
        columns: columns,
        mapping: mapping,
        data: uploadedData,
        year: year,
        apis: {
            tbaevent: usingTBA,
            tbamatch: usingTBAMatches,
            tbamedia: usingTBAMedia,
            desmos: usingDesmos,
            statbotics: usingStatbotics
        },
        tbakey: tbaKey,
        event: eventKey,
        theme: theme,
        notes: notes
    }
    notes.open = notesOpen
    download("settings.orpheus", JSON.stringify(data))
}
function importSettings(settings) {
    keyboardControls = settings.general.keyboardControls
    showNamesInTeamComments = settings.general.showNamesInTeamComments
    showIgnoredTeams = settings.general.showIgnoredTeams
    roundingDigits = settings.general.rounding
    rounding = Math.pow(10, roundingDigits)
    maintainedTeamPageSettings = settings.general.teamPageSettings
    showTeamIcons = settings.general.showTeamIcons
    graphSettings = settings.general.graphSettings
    robotViewScope = settings.general.robotViewScope
    starred = settings.team.starred
    ignored = settings.team.ignored
    usingStar = settings.team.usingStar
    usingIgnore = settings.team.usingIgnore
    columns = settings.columns
    saveColumns()
    saveGeneralSettings()
    saveTeams()
    mapping = settings.mapping
    localforage.setItem(MAPPING, mapping)
    localforage.setItem(DATA, settings.data)
    localforage.setItem(YEAR, settings.year)
    localforage.setItem(EVENT, settings.event)
    localforage.setItem(TBA_KEY, settings.tbakey)
    usingTBA = settings.apis.tbaevent
    usingTBAMatches = settings.apis.tbamatch
    usingTBAMedia = settings.apis.tbamedia
    usingStatbotics = settings.apis.statbotics
    usingDesmos = settings.apis.desmos
    notes = settings.notes
    saveNotes()
    setEnabledAPIS()
    changeThemeTo(settings.theme)
    window.location.reload()
}

document.querySelector("#top-export-settings").addEventListener("click", exportSettings)
document.querySelector("#top-import-settings").addEventListener("click", () => {
    loadFile(["orpheus"], (a) => {
        let data = JSON.parse(a)
        importSettings(data)
    })
})

function closeCredits() {
    document.querySelector(".sticky-header").classList.remove("hidden")
    if (tableMode === "team")
        document.querySelector(".team-page").classList.remove("hidden")
    else {
        document.querySelector(".table.main-table").classList.remove("hidden")
        document.querySelector(".table-head.main-table").classList.remove("hidden")
    }

    document.querySelector(".credits").classList.add("hidden")
}

document.querySelector("#top-credits").addEventListener("click", () => {
    document.querySelector(".team-page").classList.add("hidden")
    document.querySelector(".table.main-table").classList.add("hidden")
    document.querySelector(".table-head.main-table").classList.add("hidden")

    document.querySelector(".credits").classList.remove("hidden")

    document.querySelector("#close-credits").innerText = "Return to " + (tableMode === "team" ? "team page" : "table")
})
document.querySelector("#close-credits").addEventListener("click", closeCredits)

document.querySelector("#top-reset-preferences").addEventListener("click", () => {
    if (!confirm("Are you sure? This will clear all saved data, preferences, columns, etc, and cannot be undone.")) return
    for (let key of LOCAL_STORAGE_KEYS) localforage.removeItem(key)
    window.location.reload()
})

//#endregion

//#region Notes, Teamlist, View Robots
let notes
let starbook = {
    open: false,
    stars: false,
    ignored: false,
    other: false,
}

function openNotes() {
    let notebook = document.createElement("div")
    notebook.className = "notebook"

    let notebookNav = document.createElement("div")
    notebookNav.className = "notebook-nav"
    notebook.appendChild(notebookNav)

    let notebookContents = document.createElement("textarea")
    notebookContents.className = "notes"
    notebookContents.value = notes.tabs[notes.activeTab]
    notebookContents.style.width = "300px"
    notebookContents.style.height = "200px"
    notebookContents.addEventListener("focus", () => {
        brieflyDisableKeyboard = true
    })
    notebookContents.addEventListener("blur", () => {
        brieflyDisableKeyboard = false
    })
    notebookContents.addEventListener("change", () => {
        notes.tabs[notes.activeTab] = notebookContents.value
        saveNotes()
    })
    notebookContents.addEventListener("mousemove", () => {
        notebook.style.maxWidth = notebookContents.offsetWidth + "px"
    })
    notebook.appendChild(notebookContents)

    let tabElements = []

    let drag = document.createElement("span")
    drag.className = "material-symbols-outlined notebook-drag"
    drag.innerText = "drag_indicator"

    let dragging = false
    let dragScreenStart
    let dragPositionStart

    drag.addEventListener("mousedown", (e) => {
        dragScreenStart = {x: e.clientX, y: e.clientY}
        dragPositionStart = {x: notebook.offsetLeft, y: notebook.offsetTop}
        dragging = true
    })
    document.body.addEventListener("mousemove", (e) => {
        if (dragging) {
            notebook.style.left = (dragPositionStart.x - (dragScreenStart.x - e.clientX)) + "px"
            notebook.style.top = (dragPositionStart.y - (dragScreenStart.y - e.clientY)) + "px"
        }
    })
    document.body.addEventListener("mouseup", (e) => {
        dragging = false
    })
    notebookNav.appendChild(drag)

    let close = document.createElement("span")
    close.className = "material-symbols-outlined notebook-btn"
    close.innerText = "close"
    close.addEventListener("click", () => {
        document.querySelector(".notebook").remove()
        notes.open = !notes.open
        document.querySelector("#top-notebook").innerText = (notes.open ? "Close" : "Open") + " Notebook"
    })
    notebookNav.appendChild(close)

    let addTab = document.createElement("span")
    addTab.className = "material-symbols-outlined notebook-btn"
    addTab.innerText = "add"
    addTab.addEventListener("click", () => {
        for (let otherEl of tabElements) otherEl.classList.remove("selected")

        let tabEl = document.createElement("div")
        tabEl.className = "notebook-tab selected"
        let tab = "Tab " + (Object.keys(notes.tabs).length + 1)
        tabEl.innerText = tab
        notebookNav.appendChild(tabEl)
        tabElements.push(tabEl)

        notes.activeTab = tab
        notes.tabs[tab] = ""
        notebookContents.value = ""

        tabEl.addEventListener("click", () => {
            if (notes.activeTab === tab) {
                tabEl.contentEditable = true
                tabEl.focus()
                brieflyDisableKeyboard = true
            }

            for (let otherEl of tabElements) otherEl.classList.remove("selected")
            tabEl.classList.add("selected")

            notes.activeTab = tab
            notebookContents.value = notes.tabs[notes.activeTab]
        })

        tabEl.addEventListener("blur", () => {
            brieflyDisableKeyboard = false
            tabEl.contentEditable = false
            if (tabEl.innerText === "\n") {
                delete notes.tabs[notes.activeTab]
                tabElements.splice(tabElements.indexOf(tabEl), 1)
                tabEl.remove()
                notes.activeTab = Object.keys(notes.tabs)[0]
                notebookContents.value = notes.tabs[notes.activeTab]
                tabElements[0].classList.add("selected")
            }
            saveNotes()
        })

        tabEl.addEventListener("keyup", (e) => {
            if (e.key === "Enter") {
                e.preventDefault()
                tabEl.innerText = notes.activeTab
            }
            let text = notes.tabs[tab]
            delete notes.tabs[notes.activeTab]
            notes.activeTab = tab = tabEl.innerText
            notes.tabs[tab] = text
            saveNotes()
        })

        brieflyDisableKeyboard = true
        tabEl.contentEditable = true
        tabEl.focus()

    })
    notebookNav.appendChild(addTab)

    for (let tab of Object.keys(notes.tabs)) {
        let tabEl = document.createElement("div")
        tabEl.className = "notebook-tab"
        tabEl.innerText = tab
        if (tab === notes.activeTab) tabEl.classList.add("selected")
        notebookNav.appendChild(tabEl)
        tabElements.push(tabEl)

        tabEl.addEventListener("click", () => {
            if (notes.activeTab === tab) {
                tabEl.contentEditable = true
                tabEl.focus()
                brieflyDisableKeyboard = true
            }

            for (let otherEl of tabElements) otherEl.classList.remove("selected")
            tabEl.classList.add("selected")

            notes.activeTab = tab
            notebookContents.value = notes.tabs[notes.activeTab]
        })

        tabEl.addEventListener("blur", () => {
            brieflyDisableKeyboard = false
            tabEl.contentEditable = false
            if (tabEl.innerText === "\n") {
                delete notes.tabs[notes.activeTab]
                tabElements.splice(tabElements.indexOf(tabEl), 1)
                tabEl.remove()
                notes.activeTab = Object.keys(notes.tabs)[0]
                notebookContents.value = notes.tabs[notes.activeTab]
                tabElements[0].classList.add("selected")
            }
            saveNotes()
        })

        tabEl.addEventListener("keyup", (e) => {
            if (e.key === "Enter") {
                e.preventDefault()
                tabEl.innerText = notes.activeTab
            }
            let text = notes.tabs[tab]
            delete notes.tabs[notes.activeTab]
            notes.activeTab = tab = tabEl.innerText
            notes.tabs[tab] = text
            saveNotes()
        })
    }

    document.body.appendChild(notebook)
    notebook.style.left = (window.innerWidth * .5) + "px"
    notebook.style.top = (window.innerHeight * .2) + "px"
    notebook.style.maxWidth = notebookContents.offsetWidth + "px"
}

document.querySelector("#top-notebook").addEventListener("click", () => {
    if (notes.open) document.querySelector(".notebook").remove()
    else openNotes()
    notes.open = !notes.open
    document.querySelector("#top-notebook").innerText = (notes.open ? "Close" : "Open") + " Notebook"
})

document.querySelector("#top-notebook-clear").addEventListener("click", () => {
    if (!confirm("Are you sure? This cannot be undone.")) return
    notes.activeTab = "Tab 1"
    notes.tabs = {"Tab 1": ""}
    if (notes.open) document.querySelector(".notebook").remove()
    openNotes()
    saveNotes()
})

function saveNotes() {
    let isOpen = notes.open
    notes.open = false
    localforage.setItem(NOTES, notes)
    notes.open = isOpen
}

document.querySelector("#top-stars").addEventListener("click", () => {
    setStarbook()
    document.querySelector(".notebook-stars").classList.toggle("hidden")
    starbook.open = !starbook.open
    document.querySelector("#top-stars").innerText = (starbook.open ? "Close" : "Open") + " team list"
})
document.querySelector(".notebook-stars").style.left = (window.innerWidth * .5) + "px"
document.querySelector(".notebook-stars").style.top = (window.innerHeight * .2) + "px"

function setStarbook() {
    let starbookEl = document.querySelector(".notebook-stars")
    starbookEl.innerHTML = ""

    let notebookNav = document.createElement("div")
    notebookNav.className = "notebook-nav"
    starbookEl.appendChild(notebookNav)

    //#region Drag
    let drag = document.createElement("span")
    drag.className = "material-symbols-outlined notebook-drag"
    drag.innerText = "drag_indicator"

    let dragging = false
    let dragScreenStart
    let dragPositionStart

    drag.addEventListener("mousedown", (e) => {
        dragScreenStart = {x: e.clientX, y: e.clientY}
        dragPositionStart = {x: starbookEl.offsetLeft, y: starbookEl.offsetTop}
        dragging = true
    })
    document.body.addEventListener("mousemove", (e) => {
        if (dragging) {
            starbookEl.style.left = (dragPositionStart.x - (dragScreenStart.x - e.clientX)) + "px"
            starbookEl.style.top = (dragPositionStart.y - (dragScreenStart.y - e.clientY)) + "px"
        }
    })
    document.body.addEventListener("mouseup", (e) => {
        dragging = false
    })
    notebookNav.appendChild(drag)
    //#endregion

    let teamListTitle = document.createElement("div")
    teamListTitle.innerText = "Team List"
    notebookNav.appendChild(teamListTitle)

    let remainingTeams = []
    for (let team of Object.keys(team_data))
        if (!ignored.includes(team) && !starred.includes(team))
            remainingTeams.push(team)

    function group(title, teams, showing) {
        let toggler = document.createElement("div")
        toggler.className = "starbook-toggler"
        starbookEl.appendChild(toggler)

        let dropdown = document.createElement("span")
        dropdown.className = "material-symbols-outlined"
        dropdown.innerText = showing ? "keyboard_arrow_down" : "keyboard_arrow_right"
        toggler.appendChild(dropdown)

        let titleEl = document.createElement("div")
        titleEl.innerText = title
        toggler.appendChild(titleEl)

        if (showing) {
            let teamHolder = document.createElement("div")
            teamHolder.className = "starbook-team-list"
            for (let team of teams) {
                let teamEl = document.createElement("div")
                teamEl.className = "starbook-team"
                teamHolder.appendChild(teamEl)

                teamEl.innerText = team + " " + team_data[team].Name
            }
            starbookEl.appendChild(teamHolder)
        }

        return toggler
    }
    group("Starred Teams", starred, starbook.stars).addEventListener("click", () => {
        starbook.stars = !starbook.stars
        setStarbook()
    })
    group("Ignored Teams", ignored, starbook.ignored).addEventListener("click", () => {
        starbook.ignored = !starbook.ignored
        setStarbook()
    })
    group("Remaining Teams", remainingTeams, starbook.other).addEventListener("click", () => {
        starbook.other = !starbook.other
        setStarbook()
    })
}

//#endregion

//#region Init

let initLoading = 12

// Year
localforage.getItem(THEME, (err, val) => {
    if (val === null) theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    else theme = val
    changeThemeTo(theme)
    if (!--initLoading) finishInit()
})

localforage.getItem(YEAR, (err, val) => {
    year = val
    if (year === null || year < 1992) {
        year = new Date().getFullYear().toString()
        localforage.setItem(YEAR, new Date().getFullYear().toString())
    }
    document.querySelector("#top-year").innerText = year
    if (!--initLoading) finishInit()
})

// General Settings Setup
localforage.getItem(SETTINGS, (err, settings) => {
    if (settings === null) {
        settings = {
            "keyboardControls": true,
            "showNamesInTeamComments": true,
            "showIgnoredTeams": true,
            "rounding": 3,
            "teamPageSettings": {
                "teamInfoWidth": 450,
                "graphHeight": 500,
                "showMatches": true,
            },
            "graphSettings": {
                x: "relative", // relative or absolute
                points: true,
                bestfit: true,
            },
            "showTeamIcons": true,
        }
        localforage.setItem(SETTINGS, settings)
    }

    keyboardControls = settings.keyboardControls
    document.querySelector("#top-keyboard").innerText = "Keyboard Controls: " + (keyboardControls ? "Enabled" : "Disabled")
    showNamesInTeamComments = settings.showNamesInTeamComments
    document.querySelector("#top-show-hide-comment-names").innerText = "Names in Comments: " + (showNamesInTeamComments ? "Shown" : "Hidden")
    showIgnoredTeams = settings.showIgnoredTeams
    document.querySelector("#top-show-hide-ignored").innerText = "Ignored Teams: " + (showIgnoredTeams ? "Shown" : "Hidden")
    roundingDigits = settings.rounding
    rounding = Math.pow(10, roundingDigits)
    setRoundingEl()
    showTeamIcons = settings.showTeamIcons

    if (settings.robotViewScope !== undefined)
        robotViewScope = settings.robotViewScope

    maintainedTeamPageSettings = settings.teamPageSettings

    graphSettings = settings.graphSettings
    document.querySelector("#top-graph-x").innerText = "X Axis: " + (graphSettings.x === "relative" ? "Relative" : "Absolute")
    if (graphSettings.points) {
        if (graphSettings.bestfit) document.querySelector("#top-graph-display").innerText = "Graphs: Points & Lines"
        else document.querySelector("#top-graph-display").innerText = "Graphs: Only Points"
    } else document.querySelector("#top-graph-display").innerText = "Graphs: Only lines of best fit"

    if (!--initLoading) finishInit()
})

// Stars and Ignore setup
localforage.getItem(TEAM_SAVES, (err, val) => {
    if (val === null) {
        val = {
            "starred": [],
            "ignored": [],
            "usingStar": true,
            "usingIgnore": true,
        }
        teamSaves = val
    } else teamSaves = val
    starred = teamSaves.starred
    ignored = teamSaves.ignored
    usingStar = teamSaves.usingStar
    usingIgnore = teamSaves.usingIgnore
    saveTeams()

    if (!--initLoading) finishInit()
})

// Loading saved mappings or data
localforage.getItem(DATA, (err, val) => {
    uploadedData = val == null ? undefined : val
    if (!--initLoading) finishInit()
})
localforage.getItem(MAPPING, (err, val) => {
    mapping = val == null ? undefined : val
    document.querySelector("#top-mapping-download").disabled = mapping === undefined
    dataButtons()
    if (!--initLoading) finishInit()
})

// Loading saved columns
localforage.getItem(WIDGETS, (err, val) => {
    // TODO add widget layout saving
    if (!--initLoading) finishInit()
})

// Saved API Data
localforage.getItem(SAVED_API_DATA, (err, val) => {
    api_data = val
    if (api_data === null) api_data = {}
    if (!navigator.onLine) {
        document.querySelector(":root").classList.add("offline")
        console.log("No Internet")
        usingOffline = true
    } else {
        api_data = {}
        saveAPIData()
    }
    if (!--initLoading) finishInit()
})
if (!usingOffline) {
    saveAPIData()
}

// Apis
localforage.getItem(ENABLED_APIS, (err, apis) => {
    if (apis === null) {
        localforage.setItem(ENABLED_APIS, {tbaevent: true, tbamatch: true, tbamedia: true, desmos: true, statbotics: true})
        apis = {tbaevent: true, tbamatch: true, tbamedia: true, desmos: true, statbotics: true}
    }

    if (usingOffline) {
        apis = api_data.apis
    }
    document.querySelector("#top-last-saved-apis").innerText = "Last Saved for offline use: \n" + api_data["lastSaved"]

    usingTBA = apis.tbaevent
    document.querySelector("#top-toggle-use-tbaevent").innerText = "TBA API: " + (usingTBA ? "Enabled" : "Disabled")

    usingTBAMatches = apis.tbamatch
    document.querySelector("#top-toggle-use-tbamatch").innerText = "TBA API (Matches): " + (usingTBAMatches ? "Enabled" : "Disabled")
    if (!usingTBA) {
        usingTBAMatches = false
        document.querySelector("#top-toggle-use-tbamatch").innerText = "TBA API (Media): Disabled"
        document.querySelector("#top-toggle-use-tbamatch").disabled = true
    }

    usingTBAMedia = apis.tbamedia
    document.querySelector("#top-toggle-use-tbamedia").innerText = "TBA API (Media): " + (usingTBAMedia ? "Enabled" : "Disabled")
    if (!usingTBA) {
        usingTBAMedia = false
        document.querySelector("#top-toggle-use-tbamedia").innerText = "TBA API (Media): Disabled"
        document.querySelector("#top-toggle-use-tbamedia").disabled = true
    }
    showTeamIcons = showTeamIcons ? (usingTBA && usingTBAMedia) : false
    saveGeneralSettings()

    usingDesmos = apis.desmos
    document.querySelector("#top-toggle-use-desmos").innerText = "Desmos API: " + (usingDesmos ? "Enabled" : "Disabled")
    if (usingDesmos) {
        let desmosScript = document.createElement("script")
        document.head.appendChild(desmosScript)
        desmosScript.src = desmosScriptSrc
        loading++
        checkLoading()
        desmosScript.addEventListener("load", () => {
            loading--
            if (initLoading === 0) checkLoading()
        })
    }
    // TODO: if desmos is disabled then disable the graph settings options

    usingStatbotics = apis.statbotics
    document.querySelector("#top-toggle-use-statbotics").innerText = "Statbotics: " + (usingStatbotics ? "Enabled" : "Disabled")

    if (!--initLoading) finishInit()
})

// Notes
localforage.getItem(NOTES, (err, val) => {
    if (val == null) {
        notes = {
            activeTab: "Tab 1",
            open: false,
            tabs: {
                "Tab 1": "",
            }
        }
        saveNotes()
    } else notes = val
    if (!--initLoading) finishInit()
})

localforage.getItem(TBA_KEY, (err, val) => {
    if (val !== null) tbaKey = val
    if (!--initLoading) finishInit()
})

localforage.getItem(EVENT, (err, val) => {
    if (val != null) eventKey = val
    if (!--initLoading) finishInit()
})

// Version and Title
for (let el of document.querySelectorAll(".tool-name"))
    el.innerText = toolName + (usingOffline ? " (Offline)" : "")
for (let el of document.querySelectorAll(".version"))
    el.innerText = toolName + " v"+version

let table = new Table()
main.addChild(table)

function finishInit() {
    // View robots
    if (usingTBAMedia || (mapping["pit_scouting"] !== undefined && mapping["pit_scouting"]["image"] !== undefined)) {
        document.querySelector("#top-pictures").disabled = false
    }

    // Final Prep
    if (eventKey)
        document.querySelector("#top-load-event").innerText = eventKey.toUpperCase()
    if (usingTBA) {
        loading++
        checkLoading()
        loading--
    }
    loadEvent()
}

//#endregion
