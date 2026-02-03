'use strict';

//#region Variables
let headerControlsShowing = false

const storageKeys = {
    EVENT: "scouting_4915_event",
    DATA: "scouting_4915_data",
    MAPPING: "scouting_4915_mapping",
    THEME: "scouting_4915_theme",
    ENABLED_APIS: "scouting_4915_apis",
    SETTINGS: "scouting_4915_settings_general",
    TEAM_SAVES: "scouting_4915_settings_starignore",
    SAVED_API_DATA: "scouting_4915_api_saved",
}

const MISSING_LOGO = "https://frc-cdn.firstinspires.org/eventweb_frc/ProgramLogos/FIRSTicon_RGB_withTM.png"

const toolName = "Orpheus"
const version = 0.1

let eventKey
let event_data
let uploadedData = {}
let team_data = {}
let api_data = {}
let tba_match_data = {}

let mapping
let gameMapping

let theme

let loading = 0

let showTeamIcons

let roundingDigits = 3
let rounding = Math.pow(10, roundingDigits)

let onDesmosLoad = []

/*
This API key should only be used on Orpheus. If you fork Orpheus, please get your own API key from https://www.thebluealliance.com/
*/
const TBA_KEY = "bmeU7Z99M2lCyuStu4sKU7NuLvsZAE3UoxBgxR5J3fcK6hDoZx92FcURLEHyHgTM"
let usingTBA
let usingTBAMatches
let usingTBAMedia
let usingTBARank
let usingDesmos
let usingStatbotics

let projectorMode = false

let usingOffline = false

let processedData = {
    "orpheus": {
        "data": {
            "number": {},
            "name": {},
            "ranking": {},
            "matches_played": {},
        }
    }
}

let graphSettings = {
    x: "relative",
    points: true,
    bestfit: true
}
//#endregion

//#region Init header controls
for (let el of document.querySelector("#top-controls").children) {
    if (el.tagName === "BUTTON" && el.classList.contains("dropdown-button")) {
        el.onclick = function() {
            for (let el of document.getElementsByClassName("top-control-dropdown"))
                el.close()
            let modal = document.querySelector(`dialog[for="${el.id}"]`)
            modal.show()
            headerControlsShowing = false
            setTimeout(() => headerControlsShowing = true, 0)
        }
    } else if (el.tagName === "DIALOG") {
        el.onclick = function() {
            headerControlsShowing = false
            setTimeout(() => headerControlsShowing = true, 0)
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
    if (headerControlsShowing) {
        for (let el of document.getElementsByClassName("top-control-dropdown"))
            el.close()
        headerControlsShowing = false
    }
})
//#endregion

//#region Event Loading
document.querySelector("#top-load-event").onclick = function() {
    let x = prompt("What event code do you want? For example: 2024wabon, 2025waahs, 2025pncmp, etc")
    if (x === "get") alert(eventKey)
    else if (x === "clear") {
        localforage.removeItem(storageKeys.EVENT)
        window.location.reload()
    }
    else if (x !== "") {
        localforage.setItem(storageKeys.EVENT, x.toLowerCase())
        window.location.reload()
    }

}
function loadEvent() {
    if (usingTBA) {
        load("event/" + eventKey + "/teams", function (data) {
            event_data = data

            for (let team of data) {
                let teamNum = team["team_number"]
                team_data[teamNum] = {}
                team_data[teamNum].Team_Number = teamNum
                team_data[teamNum].Name = team["nickname"]
                team_data[teamNum].TBA = team
                team_data[teamNum].TBA["matches"] = {}
                team_data[teamNum].media = []
                processedData["orpheus"]["data"]["name"][teamNum] = team["nickname"]
                main.hardRefresh()
                if (usingTBAMedia) {
                    load("team/frc" + teamNum + "/media/" + gameMapping.year, function (data) {
                        team_data[teamNum].TBA.images = []

                        for (let x of data) {
                            if (x.type === "avatar") {
                                team_data[teamNum].Icon = "data:image/png;base64," + x.details["base64Image"]
                                main.hardRefresh()
                            }
                            else if (x.type === "imgur") team_data[teamNum].media.push({type: "image", src: x["direct_url"]})
                            else console.log("Unsupported media type: " + x.type + ". (Team " + teamNum + ")")
                        }
                    })
                }
                if (usingStatbotics) {
                    loadOther("https://api.statbotics.io/v3/team_event/" + teamNum + "/" + eventKey, function(data) {
                        team_data[teamNum]["statbotics"] = data
                        team_data[teamNum]["EPA"] = data["epa"]["total_points"]["mean"]
                        team_data[teamNum]["Auto EPA"] = data["epa"]["breakdown"]["auto_points"]
                        team_data[teamNum]["Teleop EPA"] = data["epa"]["breakdown"]["teleop_points"]
                        team_data[teamNum]["Endgame EPA"] = data["epa"]["breakdown"]["endgame_points"]
                    })
                }
            }
        })
        if (usingTBAMatches) {
            load("event/" + eventKey + "/matches", function (data) {
                tba_match_data = {}
                for (let m of data) {
                    if (m["comp_level"] === "qm") {
                        tba_match_data[m["match_number"]] = m
                    }
                }
            })
        }
        if (usingTBARank) {
            load("event/" + eventKey + "/rankings", function (data) {
                for (let extra in data["extra_stats_info"]) {
                    internalMapping[data["extra_stats_info"][extra]["name"]] = {"alias": data["extra_stats_info"][extra]["name"]}
                    processedData["orpheus"]["data"][data["extra_stats_info"][extra]["name"]] = {}
                }

                for (let i in data["rankings"]) {
                    let team = parseInt(data["rankings"][i]["team_key"].substring(3))
                    processedData["orpheus"]["data"]["ranking"][team] = data["rankings"][i]["rank"]
                    processedData["orpheus"]["data"]["matches_played"][team] = data["rankings"][i]["matches_played"]

                    for (let extra in data["extra_stats_info"]) {
                        processedData["orpheus"]["data"][data["extra_stats_info"][extra]["name"]][team] = data["rankings"][i]["extra_stats"][extra]
                    }
                }
            })
        }
    }
}
//#endregion

//#region Data and Mappings
// Import mapping button
document.querySelector("#top-mapping").onclick = function() {
    loadFile(".json", (result) => {
        mapping = JSON.parse(result)
        localforage.setItem(storageKeys.MAPPING, mapping)
        //columns = JSON.parse(JSON.stringify(availableColumns))
        location.reload()
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
    },
    "name": {
        "alias": "Team Name"
    },
    "matches_played": {
        "alias": "Matches Played"
    },
    "ranking": {
        "alias": "Event Rank"
    },
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
            return (parseInt(tba_match_data[datum[mapping[schema]["match_key"]]]["alliances"]["red"]["team_keys"][team.slice(team.indexOf(/\s/g)) - 1].slice(3)))

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
    // Gives each team their matches
    if (usingTBAMatches) {
        for (let t in team_data) {
            let matches = {}
            for (let m in tba_match_data) matches[m] = tba_match_data[m]
            team_data[t]["TBA"]["matches"] = matches
        }
    }

    let dataOut = {}
    let teamMedia = {}

    // Get a list of teams
    let teams = new Set()
    for (let schema of Object.keys(mapping)) {
        for (let datum of uploadedData[schema]) {
            teams.add(getTeam(schema, datum[mapping[schema]["team_key"]]))
        }
    }

    function handleData(schema, datumMapping, context) {
        let out = {}
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
                                "red 1": parseInt(tba_match_data[matchNum]["alliances"]["red"]["team_keys"][0].slice(3)),
                                "red 2": parseInt(tba_match_data[matchNum]["alliances"]["red"]["team_keys"][1].slice(3)),
                                "red 3": parseInt(tba_match_data[matchNum]["alliances"]["red"]["team_keys"][2].slice(3)),
                                "blue 1": parseInt(tba_match_data[matchNum]["alliances"]["blue"]["team_keys"][0].slice(3)),
                                "blue 2": parseInt(tba_match_data[matchNum]["alliances"]["blue"]["team_keys"][1].slice(3)),
                                "blue 3": parseInt(tba_match_data[matchNum]["alliances"]["blue"]["team_keys"][2].slice(3))
                            }
                            let alliance = tba_match_data[matchNum]["alliances"]["red"]["team_keys"].includes("frc"+team) ? "red" : "blue"
                            let position = tba_match_data[matchNum]["alliances"][alliance]["team_keys"].indexOf("frc"+team) + 1

                            otherBots["other 1"] = parseInt(tba_match_data[matchNum]["alliances"][alliance]["team_keys"][((position + 1) % 3)].slice(3))
                            otherBots["other 2"] = parseInt(tba_match_data[matchNum]["alliances"][alliance]["team_keys"][((position) % 3)].slice(3))

                            let evalContext = Object.assign({
                                "match": matchNum,
                                "team": team,
                                "data": match,
                                "tba": tba_match_data[matchNum],
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
                    for (let team of teams) {
                        if (typeof teamMedia[team] === "undefined") teamMedia[team] = []
                    }
                    for (let i of uploadedData[schema]) {
                        let team = getTeam(schema, i[mapping[schema]["team_key"]])
                        if (typeof datumMapping[x]["key"] === "string") {
                            if (i[datumMapping[x]["key"]].trim() !== "")
                                teamMedia[team].push(i[datumMapping[x]["key"]])
                        }
                        else {
                            for (let key of datumMapping[x]["key"])
                                if (i[key].trim() !== "")
                                    teamMedia[team].push(i[key])
                        }
                    }
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

    processedData = Object.assign({}, processedData, dataOut)

    let orpheus = processedData["orpheus"]
    for (let team of teams) {
        orpheus["data"]["number"][team] = team
    }
    processedData["orpheus"] = orpheus

    for (let teamNum in teamMedia) {
        for (let media of teamMedia[teamNum]) {
            // Add to start instead of pushing to the end. This is so scouting images will always come before images sourced from TBA, which may be outdated
            if (typeof team_data[teamNum] !== "undefined") team_data[teamNum].media.unshift({type: "image", src: media})
        }
    }

    // Temporary widget stuff for testing
    table.addColumn(["orpheus`number", "orpheus`name", "orpheus`matches_played", "orpheus`ranking"])
    table.addTeam(teams)

    table2.addColumn(["orpheus`number", "orpheus`name", "match`Scoring`Coral Scored", "match`tba climb"])
    table2.addTeam(teams)
    table2.addColumn("pit`Drivetrain")

    graph = new Graph()
    tabGroup.addChild(graph)

    teamInfo = new TeamInfo()
    teamInfo.setTeams(Object.keys(team_data))
    tabGroup.addChild(teamInfo)

    media4915 = new TeamMedia()
    media4915.setTeam(4915)
    tabGroup.addChild(media4915)

    let media3876 = new TeamMedia() // has no media
    media3876.setTeam(3876)
    tabGroup.addChild(media3876)
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

    return math.evaluate(replaceConstants(expression), functions)
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
            localforage.setItem(storageKeys.DATA, uploadedData)
            document.querySelector("#top-download-" + schema).disabled = false
            saveGeneralSettings()
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

function getColumnFromID(id) {
    let data = id.split("`")[0]
    let location = id.split("`").slice(1)

    let col
    if (data === "orpheus") {
        col = internalMapping
        for (let x of location) col = col[x]
    }
    else {
        col = mapping[data]["data"]
        for (let x of location) col = col[x]
    }

    let dataCol = processedData[data]["data"]
    for (let x of location) dataCol = dataCol[x]

    let name = col["alias"] ? col["alias"] : id.split("`")[id.split("`").length - 1]

    return {
        name,
        id,
        "mapping": col,
        data: dataCol
    }
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
    main.hardRefresh()
}
function setRoundingEl() {
    document.querySelector("#top-rounding").innerText = "Rounding: " + (roundingDigits === 0 ? "Integer" : (roundingDigits === 16 ? "Float" : roundingDigits + " digits"))
}

document.querySelector("#top-clear-files").addEventListener("click", () => {
    localforage.removeItem(storageKeys.DATA)
    localforage.removeItem(storageKeys.MAPPING)
    window.location.reload()
})

//#endregion

//#region Lists
class List {
    constructor(name, icon, color, sort = List.Sort.NO_CHANGE, teams = [], editable = true) {
        this.name = name
        this.icon = icon
        this.sort = sort
        this.color = color
        this.teams = teams
        this.editable = editable
        this.id = Widget.generateId()
    }

    add(team) {
        if (!this.teams.includes(team)) this.teams.push(team)
        main.refresh()
        Events.emit(Events.LIST_CHANGE)
    }
    remove(team) {
        if (this.teams.includes(team)) this.teams.splice(this.teams.indexOf(team), 1)
        main.refresh()
        Events.emit(Events.LIST_CHANGE)
    }
    includes(team) {
        return this.teams.includes(team)
    }
    indexOf(team) {
        return this.teams.indexOf(team)
    }
    toggle(team) {
        if (this.includes(team)) this.remove(team)
        else this.add(team)
        main.refresh()
        Events.emit(Events.LIST_CHANGE)
    }
    reorder(team, index) {
        [this.teams[index], this.teams[this.teams.indexOf(team)]] = [this.teams[this.teams.indexOf(team)], this.teams[index]]
        main.refresh()
        Events.emit(Events.LIST_CHANGE)
    }

    static ICONS = [
        "favorite",
        "star",
        "check_box",
        "check_circle",
        "cancel",
        "bolt",
        "block",
        "do_not_disturb_on",
        "person",
        "skull",
        "handshake",
        "mood",
        "sentiment_satisfied",
        "sentiment_neutral",
        "sentiment_dissatisfied",
        "sentiment_very_dissatisfied",
        "sentiment_sad",
        "editor_choice",
        "diamond_shine",
        "bookmark",
        "bookmark_heart",
        "bookmark_flag",
        "bookmark_star",
        "skull_list",
        "rocket_launch",
        "chess_pawn",
        "falling",
        "target",
        "shield",
        "taunt",
        "filter_1",
        "filter_2",
        "filter_3",
        "filter_4",
    ]
    static Colors = Object.freeze({
        RED: {name: "Red", color: "var(--list-red)"},
        WATERMELON: {name: "Watermelon", color: "var(--list-watermelon)"},
        ORANGE: {name: "Orange", color: "var(--list-orange)"},
        GOLD: {name: "Gold", color: "var(--list-gold)"},
        LIME: {name: "Lime", color: "var(--list-lime)"},
        EMERALD: {name: "Emerald", color: "var(--list-emerald)"},
        TURQUOISE: {name: "Turquoise", color: "var(--list-turquoise)"},
        SKY: {name: "Sky", color: "var(--list-sky)"},
        BLUE: {name: "Blue", color: "var(--list-blue)"},
        PURPLE: {name: "Purple", color: "var(--list-purple)"},
        PASTEL_PURPLE: {name: "Pastel Purple", color: "var(--list-purple-pastel)"},
        MAGENTA: {name: "Magenta", color: "var(--list-magenta)"},
        BROWN: {name: "Brown", color: "var(--list-brown)"},
    })

    static Sort = Object.freeze({
        // No change between a team that has no list and a team that is on a list
        NO_CHANGE: 0,
        // Teams with a list set to SORT_ABOVE will be placed above other teams and sorted amongst themselves.
        SORT_ABOVE: 1,
        // Teams with a list set to SORT_BELOW will be placed below other teams and sorted amongst themselves.
        SORT_BELOW: 2,
        // Teams with a list set to HIDE will be hidden unless the team also has a higher priority list that isn't set to HIDE.
        HIDE: 3,
    })

    static ALL = new List("All", "", "", List.Sort.NO_CHANGE, [], false)
}
let hs = new List("High Scoring", "star", List.Colors.GOLD, List.Sort.SORT_ABOVE, [4915, 2910, 2412, 2046, 1318])
// chosen only for being the lowest 3 team numbers at 2025waahs
let ignore = new List("Ignore", "cancel", List.Colors.WATERMELON, List.Sort.SORT_BELOW, [360, 488, 1294], false)
const Lists = {
    /**
     * List priority goes from 0 to length where 0 is highest priority.
     */
    lists: [
        hs,
        new List("Picklist", "bookmark_heart", List.Colors.EMERALD, List.Sort.NO_CHANGE, [4915]),
        ignore
    ],
    add(list) {
        this.lists.push(list)
        main.hardRefresh()
    },
    remove(list) {
        this.lists.splice(this.lists.indexOf(list), 1)
        main.hardRefresh()
    },
    indexOf(list) {
        if (typeof list === "string") {
            for (let l of this.lists) if (l.id === list) return this.lists.indexOf(l)
            return -1
        }
        return this.lists.indexOf(list)
    },
    reorder(list, index) {
        [this.lists[index], this.lists[this.indexOf(list)]] = [this.lists[this.indexOf(list)], this.lists[index]]
        main.hardRefresh()
    },
    getLists(team) {
        let lists = []
        for (let list of this.lists) if (list.includes(team)) lists.push(list)
        return lists
    },
    /**
     * Gets and returns the list that affects a particular team
     * @param team - Team number
     * @param scope - An array of the lists allowed
     * @param overrides - A JSON object with key list ID: List.Sort
     */
    getListAffectingTeam(team, scope = Lists.lists, overrides = {}) {
        for (let list of scope) {
            if (list.includes(team) && list.sort !== (overrides[list.id] ?? List.Sort.NO_CHANGE)) return list
        }
        return List.ALL
    }
}
//#endregion

//#region Custom Event Handler

const Events = {
    handlers: {},
    on(event, handler, context) {
        if (typeof this.handlers[event] === "undefined") {
            this.handlers[event] = []
        }
        this.handlers[event].push({handler, context})
    },
    emit(event) {
        console.log("emitting " + event)
        if (typeof this.handlers[event] !== "undefined") {
            for (let handler of this.handlers[event]) handler.handler.call(handler.context);
        }
    },

    // List of Events
    LIST_CHANGE: 1,
}

//#endregion

//#region Theme, Projector Mode, Graph Settings
function changeThemeTo(to) {
    let root = document.querySelector(":root").classList
    root.remove("dark")
    root.remove("spartronics_theme")
    theme = to
    if (theme === "dark") root.add("dark")
    else if (theme === "4915") root.add("spartronics_theme")
    localforage.setItem(storageKeys.THEME, theme)
}
// Theme toggle button
document.querySelector("#top-theme").onclick = function() {
    changeThemeTo(theme === "light" ? "dark" : (theme === "dark" ? "4915" : "light"))
}
document.querySelector("#top-projector").addEventListener("click", () => {
    projectorMode = !projectorMode
    document.querySelector("#top-projector").innerText = "Projector Mode: " + (projectorMode ? "Enabled" : "Disabled")

    if (projectorMode) document.querySelector(":root").classList.add("projector")
    else document.querySelector(":root").classList.remove("projector")

    setTimeout(setHeaderControlsPositions, 1000)
})

document.querySelector("#top-graph-x").addEventListener("click", () => {
    graphSettings.x = graphSettings.x === "relative" ? "absolute" : "relative"

    document.querySelector("#top-graph-x").innerText = "X Axis: " + (graphSettings.x === "relative" ? "Relative" : "Absolute")

    saveGeneralSettings()
    main.hardRefresh()
})

document.querySelector("#top-graph-display").addEventListener("click", () => {
    if (graphSettings.points) {
        if (graphSettings.bestfit) {
            graphSettings.points = false
        } else {
            graphSettings.bestfit = true
        }
    } else {
        graphSettings.points = true
        graphSettings.bestfit = false
    }

    if (graphSettings.points) {
        if (graphSettings.bestfit) document.querySelector("#top-graph-display").innerText = "Graphs: Points & Lines"
        else document.querySelector("#top-graph-display").innerText = "Graphs: Only Points"
    } else document.querySelector("#top-graph-display").innerText = "Graphs: Only lines of best fit"

    saveGeneralSettings()
    main.hardRefresh()
})
//#endregion

//#region Keyboard Controls
let controlPressed = false

document.addEventListener("keydown", (e) => {
    let key = e.key.toLowerCase()
    if (key === "control") controlPressed = true
})
document.addEventListener("keyup", (e) => {
    let key = e.key.toLowerCase()
    if (key === "control") controlPressed = false
})
//#endregion

//#region File and API loading functions (+ download, API Toggles)
// Loads data from TheBlueAlliance
async function load(sub, onload) {
    return loadOther(`https://www.thebluealliance.com/api/v3/${sub}?X-TBA-Auth-Key=${TBA_KEY}`, onload)
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
        return response.json()
    }).then(data => {
        onload(data)
        api_data[url] = data
        saveAPIData()
        loading--
        checkLoading()
    })
}
function checkLoading() {
    if (loading === 0) {
        document.querySelector("#loading").className = "hidden"
        if (mapping !== undefined)
            setTimeout(() => processData(), 1)
    } else {
        document.querySelector("#loading").className = ""
        document.querySelector("#loading-text").innerText = "Loading".padEnd(10 - (loading % 4), ".")
        document.querySelector("#loading-status").innerText = "Waiting on " + loading + " requests"
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
    usingTBAMedia = usingTBAMatches = usingTBA = usingTBARank = usingDesmos = usingStatbotics = true
    setEnabledAPIS()
})
document.querySelector("#top-toggle-use-noneapi").addEventListener("click", () => {
    usingTBAMedia = usingTBAMatches = usingTBA = usingTBARank = usingDesmos = usingStatbotics = false
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
document.querySelector("#top-toggle-use-tbarank").addEventListener("click", () => {
    usingTBARank = !usingTBARank
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
    localforage.setItem(storageKeys.ENABLED_APIS, {
        tbaevent: usingTBA,
        tbamatch: usingTBAMatches,
        tbamedia: usingTBAMedia,
        tbarank: usingTBARank,
        desmos: usingDesmos,
        statbotics: usingStatbotics
    }, () => {
        location.reload()
    })
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

//#region Save Settings, Load Config File
function saveGeneralSettings() {
    localforage.setItem(storageKeys.SETTINGS, {
        "rounding": roundingDigits,
        "graphSettings": graphSettings,
        "showTeamIcons": showTeamIcons,
    })
}
function saveAPIData() {
    api_data["lastSaved"] = new Date().toLocaleString([], {year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'})
    api_data["apis"] = {
        tbaevent: usingTBA,
        tbamatch: usingTBAMatches,
        tbamedia: usingTBAMedia,
        tbarank: usingTBARank,
        desmos: false,
        statbotics: usingStatbotics
    }
    document.querySelector("#top-last-saved-apis").innerText = "Last Saved for offline use: \n" + api_data["lastSaved"]

    localforage.setItem(storageKeys.SAVED_API_DATA, api_data)
}

function exportSettings() {
    let data = {

    }
    download("settings.orpheus", JSON.stringify(data))
}
function importSettings(settings) {

}

document.querySelector("#top-export-settings").addEventListener("click", exportSettings)
document.querySelector("#top-import-settings").addEventListener("click", () => {
    loadFile(["orpheus"], (a) => {
        let data = JSON.parse(a)
        importSettings(data)
    })
})

document.querySelector("#top-reset-preferences").addEventListener("click", () => {
    if (!confirm("Are you sure? This will clear all saved data, preferences, columns, etc, and cannot be undone.")) return
    for (let key of Object.keys(storageKeys)) localforage.removeItem(key)
    window.location.reload()
})

//#endregion

//#region Init
let initLoading = 7

localforage.getItem(storageKeys.THEME, (err, val) => {
    if (val === null) theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    else theme = val
    changeThemeTo(theme)
    if (!--initLoading) finishInit()
})
localforage.getItem(storageKeys.SETTINGS, (err, settings) => {
    if (settings === null) {
        settings = {
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
        localforage.setItem(storageKeys.SETTINGS, settings)
    }

    roundingDigits = settings.rounding
    rounding = Math.pow(10, roundingDigits)
    setRoundingEl()
    showTeamIcons = settings.showTeamIcons

    graphSettings = settings.graphSettings
    document.querySelector("#top-graph-x").innerText = "X Axis: " + (graphSettings.x === "relative" ? "Relative" : "Absolute")
    if (graphSettings.points) {
        if (graphSettings.bestfit) document.querySelector("#top-graph-display").innerText = "Graphs: Points & Lines"
        else document.querySelector("#top-graph-display").innerText = "Graphs: Only Points"
    } else document.querySelector("#top-graph-display").innerText = "Graphs: Only lines of best fit"

    if (!--initLoading) finishInit()
})
localforage.getItem(storageKeys.DATA, (err, val) => {
    uploadedData = val == null ? undefined : val
    if (!--initLoading) finishInit()
})
localforage.getItem(storageKeys.MAPPING, (err, val) => {
    if (val == null) {
        document.querySelector("#top-mapping-download").disabled = true
    } else {
        mapping = val["data"]
        gameMapping = val["game"]
    }

    dataButtons()
    if (!--initLoading) finishInit()
})
localforage.getItem(storageKeys.SAVED_API_DATA, (err, val) => {
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

localforage.getItem(storageKeys.ENABLED_APIS, (err, apis) => {
    if (apis === null) {
        localforage.setItem(storageKeys.ENABLED_APIS, {tbaevent: true, tbamatch: true, tbamedia: true, tbarank: true, desmos: true, statbotics: true})
        apis = {tbaevent: true, tbamatch: true, tbamedia: true, tbarank: true, desmos: true, statbotics: true}
    }
    console.log(apis)

    if (usingOffline) {
        apis = api_data.apis
    }
    document.querySelector("#top-last-saved-apis").innerText = "Last Saved for offline use: \n" + api_data["lastSaved"]

    usingTBA = apis.tbaevent
    document.querySelector("#top-toggle-use-tbaevent").innerText = "TBA API: " + (usingTBA ? "Enabled" : "Disabled")

    usingTBAMatches = apis.tbamatch && usingTBA
    document.querySelector("#top-toggle-use-tbamatch").innerText = "TBA API (Matches): " + (usingTBAMatches ? "Enabled" : "Disabled")

    usingTBAMedia = apis.tbamedia && usingTBA
    document.querySelector("#top-toggle-use-tbamedia").innerText = "TBA API (Media): " + (usingTBAMedia ? "Enabled" : "Disabled")

    showTeamIcons = showTeamIcons ? (usingTBA && usingTBAMedia) : false
    saveGeneralSettings()

    usingTBARank = apis.tbarank && usingTBA
    document.querySelector("#top-toggle-use-tbarank").innerText = "TBA API (Event Ranking): " + (usingTBARank ? "Enabled" : "Disabled")

    if (!usingTBA) {
        document.querySelector("#top-toggle-use-tbamatch").disabled = true
        document.querySelector("#top-toggle-use-tbamedia").disabled = true
        document.querySelector("#top-toggle-use-tbarank").disabled = true
    }

    showTeamIcons = showTeamIcons && usingTBA && usingTBAMedia
    saveGeneralSettings()

    usingDesmos = apis.desmos
    document.querySelector("#top-toggle-use-desmos").innerText = "Desmos API: " + (usingDesmos ? "Enabled" : "Disabled")

    usingStatbotics = apis.statbotics
    document.querySelector("#top-toggle-use-statbotics").innerText = "Statbotics: " + (usingStatbotics ? "Enabled" : "Disabled")

    if (!--initLoading) finishInit()
})
localforage.getItem(storageKeys.EVENT, (err, val) => {
    if (val != null) eventKey = val
    if (!--initLoading) finishInit()
})

// Version and Title
for (let el of document.querySelectorAll(".tool-name"))
    el.innerText = toolName + (usingOffline ? " (Offline)" : "")
for (let el of document.querySelectorAll(".version"))
    el.innerText = toolName + " v"+version

let tabGroup = new WidgetTabGroup()

let table = new Table()
tabGroup.addChild(table)

let table2 = new Table()
table2.name = "Table 2"
tabGroup.addChild(table2)

main.addChild(tabGroup)

let graph, media4915, teamInfo

function finishInit() {
    // Final Prep
    if (eventKey) document.querySelector("#top-load-event").innerText = eventKey
    loadEvent()
}

//#endregion
