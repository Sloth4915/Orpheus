//#region Local Storage Keys
const YEAR = "scouting_4915_year"
const TBA_KEY = "scouting_4915_apikey"
const EVENT = "scouting_4915_event"
const DATA = "scouting_4915_data"
const MAPPING = "scouting_4915_mapping"
const THEME = "scouting_4915_theme"
const ENABLED_APIS = "scouting_4915_apis"
const SETTINGS = "scouting_4915_settings_general"
const COLUMNS = "scouting_4915_settings_columns"
const TEAM_SAVES = "scouting_4915_settings_starignore"
const NOTES = "scouting_4915_settings_notes"
const SAVED_API_DATA = "scouting_4915_api_saved"
const LOCAL_STORAGE_KEYS = [YEAR, TBA_KEY, EVENT, DATA, MAPPING, THEME, ENABLED_APIS, SETTINGS, COLUMNS, TEAM_SAVES, NOTES]
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
let usingStar
let ignored
let usingIgnore
let showIgnoredTeams

// For scope, 0 is shown as normal, 1 is shoved, -1 will be hidden.
let robotViewScope = {
    starred: 1,
    ignored: 1,
    normal: 1
}

let loading = 0

let showTeamIcons
let columns = [{
    "name": "Team_Number",
    "display": "#"
}]
let availableColumns = []

let selectedSort = columns[0]
let sortDirection = 1

let roundingDigits = 3
let rounding = Math.pow(10, roundingDigits)

let keyboardControls
let brieflyDisableKeyboard = false

let year

let tieValue = 0.5

let desmosColors
const desmosScriptSrc = "https://www.desmos.com/api/v1.10/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6"
let graphSettings = {
    x: "relative", // relative or absolute
    points: true,
    bestfit: true,
}

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

        let button = document.querySelector("#"+el.getAttribute("for"))
        el.style.top = button.getBoundingClientRect().bottom + 4 + "px"
        el.style.left = button.getBoundingClientRect().left + 10 + "px"
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
                        regenTable()
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
                regenTable()
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
        setColumnOptions()
        //columns = JSON.parse(JSON.stringify(availableColumns))
        processData()
        delete maintainedTeamPageSettings["graph"]
        saveColumns()
        saveGeneralSettings()
        if (doingInitialSetup) window.location.reload()
        setHeader()
    })
}

math.import({
    equal: function(a,b) {
        return a == b
    }
}, {override: true})

// Adds all the columns from the mapping to the columns list
function setColumnOptions() {
    availableColumns = []
    availableColumns.push({
        "name": "Team_Number",
        "display": "#",
        "size": 1,
    })
    if (usingTBA) availableColumns.push({"name": "Name", "display": "string", "size": 2})
    if (usingTBAMatches) availableColumns.push({"name": "Winrate", "display": "%", "size": 1}, {"name": "Matches Played", "display": "#", "size": 1}, {"name": "Average Alliance Penalties", "display": "#", "size": 1})
    if (usingStatbotics) {
        availableColumns.push({"name": "District Points", "display": "#", "size": 1})
        availableColumns.push({"name": "EPA", "display": "#", "size": 1})
        availableColumns.push({"name": "Auto EPA", "display": "#", "size": 1})
        availableColumns.push({"name": "Teleop EPA", "display": "#", "size": 1})
        availableColumns.push({"name": "Endgame EPA", "display": "#", "size": 1})
        availableColumns.push({"name": "Event Rank", "display": "#", "size": 1})
    }

    if (mapping !== undefined) {
        if (mapping["data"] !== undefined)
            for (let column of Object.keys(mapping["data"])) {
                if (mapping["data"][column].hidden) continue
                let display = "#"
                if (typeof mapping["data"][column].display === "object") display = "string"
                if (typeof mapping["data"][column].display === "string")
                    if (mapping["data"][column].display === "%" || mapping["data"][column].display === "percent" || mapping["data"][column].display === "percentage")
                        display = "%"
                availableColumns.push({
                    "name": column,
                    display,
                    "size": (mapping["data"][column].size !== undefined ? mapping["data"][column].size : 1)
                })
            }
        if (mapping["pit_scouting"] !== undefined && mapping["pit_scouting"]["data"] !== undefined)
            for (let column of Object.keys(mapping["pit_scouting"]["data"])) {
                if (mapping["pit_scouting"]["data"][column].hidden) continue
                let display = "string"
                if (typeof mapping["pit_scouting"]["data"][column].display === "string")
                    if (mapping["pit_scouting"]["data"][column].display === "%" || mapping["pit_scouting"]["data"][column].display === "percent" || mapping["pit_scouting"]["data"].display === "percentage")
                        display = "%"
                    else if (mapping["pit_scouting"]["data"][column].display === "#" || mapping["pit_scouting"]["data"][column].display === "num" || mapping["pit_scouting"]["data"][column].display === "number")
                        display = "#"
                availableColumns.push({
                    "name": column,
                    display,
                    "size": (mapping["pit_scouting"]["data"][column].size !== undefined ? mapping["pit_scouting"]["data"][column].display : 1)
                })
            }
    }

    let tmpColumns = []
    for (let column of columns) {
        for (let avColumn of availableColumns)
            if (avColumn.name === column.name)
                tmpColumns.push(column)
    }
    columns = tmpColumns
    saveColumns()

    setHeader()
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
                        if (datumMapping[x]["table"]) {
                            let summarize = datumMapping[x]["summarize"] ? datumMapping[x]["summarize"] : (datumMapping[x]["type"] == "ratio" ? "ratio" : "mean")
                            summarize = summarize.toLowerCase()
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
                                }
                            }
                        }
                    } // todo process for team

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
    setHeader()
}

function evaluate(expression, schema, context) {

    function replaceConstants(exp, params = {}) {
        exp = exp.replaceAll("#team#", context.team)
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

// Download buttons
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
    for (let stylesheet of document.styleSheets) {
        if (stylesheet.title === "projector") {
            stylesheet.disabled = !projectorMode
            return
        }
    }
    console.error("Couldn't find a projector mode stylesheet")
    setGraphColors()
}

function setGraphColors() {
    if (projectorMode)
        desmosColors = ["#ff0000","#00ff00","#0000ff","#000000","#dd00ff","#00ffee"]
    else
        desmosColors = [Desmos.Colors.RED, Desmos.Colors.BLUE, Desmos.Colors.GREEN, Desmos.Colors.PURPLE, Desmos.Colors.ORANGE, Desmos.Colors.BLACK]
}
//#endregion

//#region Table
let tableMode = "main"
let tableTeams = []

// Sets the table header
function setHeader() {
    let header = document.querySelector(".table-head.main-table")
    if (tableMode === "team") header = document.querySelector(".table-head.team-table")
    while (header.children.length > 0) header.children[0].remove()

    let starIgnoreHolder = document.createElement("div")
    starIgnoreHolder.className = "star-ignore-holder"
    header.appendChild(starIgnoreHolder)

    let starToggle = document.createElement("span")
    starToggle.id = "select_star"
    starToggle.className = "material-symbols-outlined ar star"
    if (usingStar) starToggle.classList.add("filled")
    starToggle.innerText = usingOffline ? starUnicode : "star"
    starToggle.addEventListener("click", star_toggle)
    starToggle.setAttribute("data-context", "star")
    starIgnoreHolder.appendChild(starToggle)

    let ignoreToggle = document.createElement("span")
    ignoreToggle.id = "select_ignore"
    ignoreToggle.className = "material-symbols-outlined ar ignore"
    if (usingIgnore) ignoreToggle.classList.add("filled")
    ignoreToggle.innerText = usingOffline ? crossOutUnicode : "block"
    ignoreToggle.addEventListener("click", ignore_toggle)
    ignoreToggle.setAttribute("data-context", "ignore")
    starIgnoreHolder.appendChild(ignoreToggle)

    if (showTeamIcons) {
        let iconPlaceholder = document.createElement("div")
        iconPlaceholder.classList.add("icon")
        iconPlaceholder.title = "Icon Placeholder"
        iconPlaceholder.setAttribute("data-context", "icon-column")
        header.appendChild(iconPlaceholder)
    }
    for (let column of columns) {
        let el = document.createElement("div")
        el.id = "select_" + column.name.replaceAll(/\W/g, "")
        el.classList.add("data")
        el.classList.add("header")
        if (column === selectedSort) {
            el.classList.add("highlighted")
            if (sortDirection === 1) el.classList.add("top")
            if (sortDirection === -1) el.classList.add("bottom")
        }
        el.addEventListener("click", () => changeSort(column))
        el.innerText = column.name.replaceAll("_", " ")
        el.setAttribute("data-context", "column")
        el.setAttribute("data-context-index", columns.indexOf(column))

        if (column.size === 0) el.classList.add("tiny")
        if (column.size === 1) {} // Regular
        if (column.size === 2) el.classList.add("large")
        if (column.size === 3) el.classList.add("massive")

        header.appendChild(el)
    }
    regenTable()
}
// Creates the element for a row in the table for the given team
function element(team) {
    if (ignored.includes(team) && !showIgnoredTeams && !(tableMode === "team" || !usingIgnore)) return

    let el = document.createElement("div")
    el.classList.add("row")
    el.id = team

    let controls = document.createElement("div")
    controls.classList.add("row-controls")

    let starEl = document.createElement("span")
    starEl.className = "material-symbols-outlined ar star"
    if (starred.includes(team)) starEl.classList.add("filled")
    starEl.onclick = () => star(team)
    starEl.innerText = usingOffline ? starUnicode : "star"
    controls.appendChild(starEl)

    let ignoreEl = document.createElement("span")
    ignoreEl.className = "material-symbols-outlined ar ignore"
    if (ignored.includes(team)) ignoreEl.classList.add("filled")
    ignoreEl.onclick = () => ignore(team)
    ignoreEl.innerText = usingOffline ? crossOutUnicode : "block"
    controls.appendChild(ignoreEl)

    el.appendChild(controls)

    if (showTeamIcons) {
        let iconParent = document.createElement("button")
        iconParent.className = "icon-holder"
        if (tableMode === "team")
            iconParent.onclick = () => {
                openTeam(team)
            }
        else iconParent.onclick = () => openTeam(team)
        let iconEl = document.createElement("img")
        iconEl.src = team_data[team].Icon
        iconEl.alt = "Icon"
        iconEl.className = "icon"
        iconEl.id = "icon-" + team
        iconEl.onerror = () => {
            team_data[team].Icon = MISSING_LOGO
            iconEl.src = MISSING_LOGO
        }
        iconEl.title = team_data[team].Name
        iconParent.appendChild(iconEl)
        el.appendChild(iconParent)
    }

    for (let column of columns) {
        let columnEl = document.createElement("div")
        columnEl.className = "data"
        let value = team_data[team][column.name]
        if (column.display === "#") value = Math.round(parseFloat(value) * rounding) / rounding
        if (column.display === "%") value = (100 * Math.round(parseFloat(value) * rounding) / rounding) + "%"
        if ((isNaN(team_data[team][column.name]) && (column.display === "%" || column.display === "#")) || team_data[team][column.name] === undefined || team_data[team][column.name] === null) {
            value = "-"
        }

        if (column.size === 0) columnEl.classList.add("tiny")
        if (column.size === 1) {} // Regular
        if (column.size === 2) columnEl.classList.add("large")
        if (column.size === 3) columnEl.classList.add("massive")

        columnEl.innerText = value
        columnEl.style.fontSize = "1.2rem"
        el.appendChild(columnEl)
    }

    if (tableMode === "team") document.querySelector(".table.team-table").appendChild(el)
    else document.querySelector(".table.main-table").appendChild(el)

    el.style.order = sort(team)
}
// Clears the table
function clearTable() {
    if (tableMode === "team")
        while (document.querySelector(".table.team-table").children.length > 0)
            document.querySelector(".table.team-table").children[0].remove()
    else
        while (document.querySelector(".table.main-table").children.length > 0)
            document.querySelector(".table.main-table").children[0].remove()
}
// Regenerates the table
function regenTable() {
    clearTable()
    sortTeams()
    if (tableMode === "team") for (let team of tableTeams) element(team)
    else for (let team of Object.keys(team_data)) element(team)

    if (ignored.length > 0) {
        if (!showIgnoredTeams && usingIgnore) {
            let el = document.createElement("div")
            el.className = "row ignoredlist"
            el.style.order = Math.pow(10,20)

            el.innerText = ignored.length + " teams ignored."

            if (tableMode !== "team") document.querySelector(".table.main-table").appendChild(el)

            let showButton = document.createElement("button")
            showButton.innerText = "Show Ignored Teams"
            showButton.addEventListener("click", () => {
                showIgnoredTeams = true
                regenTable()
            })

            el.appendChild(showButton)

            let remaining = []
            for (let x of Object.keys(team_data))
                if (!ignored.includes(x)) remaining.push(x)
            if (1 < remaining.length && remaining.length <= 6) {
                let openButton = document.createElement("button")
                openButton.innerText = "Compare Remaining " + remaining.length + " Teams"
                openButton.addEventListener("click", () => {
                    openTeam(remaining[0], remaining.slice(1,remaining.length))
                })
                el.appendChild(openButton)
            }
        } else if (usingIgnore) {
            let el = document.createElement("div")
            el.className = "row divider"
            el.style.order = Math.pow(10,8)

            let rowWidth = document.querySelector(".row:not(.table-head)") === null ? 0 : document.querySelector(".row:not(.table-head)").scrollWidth - 4;
            el.style.width = rowWidth + "px"

            if (tableMode === "team") document.querySelector(".table.team-table").appendChild(el)
            else document.querySelector(".table.main-table").appendChild(el)
        }
    }

    if (starred.length > 0 && usingStar && document.querySelector(".row:not(.table-head)") !== null) {
        let el = document.createElement("div")
        el.className = "row divider"
        el.style.order = -Math.pow(10,8)

        el.style.width = (document.querySelector(".row:not(.table-head)").scrollWidth - 4) + "px"

        if (tableMode === "team") document.querySelector(".table.team-table").appendChild(el)
        else document.querySelector(".table.main-table").appendChild(el)
    }

    for (let data of document.querySelectorAll(".data:not(.small)")) {
        let tries = 0
        while (data.scrollWidth > data.offsetWidth || data.scrollHeight > data.offsetHeight) {
            data.style.fontSize = "calc(" + data.style.fontSize + " - .05rem)"
            tries++
            if (tries > 10) break
        }
    }
}

document.querySelector(".table.main-table").addEventListener("scroll", () => {
    document.querySelector(".table-head.main-table").scrollLeft = document.querySelector(".table.main-table").scrollLeft
})
window.addEventListener("resize", regenTable)

//#endregion

//#region Team Pages, Search
let maintainedTeamPageSettings
let openedTeam

let commentsExpanded = true
let pitDataExpanded = true

function openTeam(team, comparisons, hiddenCompares) {
    hideRobotView()
    viewingRobots = false
    // Hiding table and showing team page element
    document.querySelector(".table.main-table").classList.add("hidden")
    document.querySelector(".table.main-table").innerText = ""
    document.querySelector(".table-head.main-table").classList.add("hidden")
    document.querySelector(".table-head.main-table").innerText = ""

    openedTeam = team

    let el = document.querySelector(".team-page")
    el.classList.remove("hidden")
    el.innerText = ""

    if (comparisons === undefined) comparisons = []
    if (hiddenCompares === undefined) hiddenCompares = []

    // Start of team page element assembly
    let data = team_data[team]

    let commentsEnabled = mapping !== undefined && mapping["match"]["notes"] !== undefined // todo: check
    let comments = ""

    if (commentsEnabled && data.matches !== undefined) {
        for (let match of data.matches) {
            if ((""+match[mapping["match"]["notes"]]).trim() !== "")
                if (match[mapping["match"]["notes"]] !== 0)
                    if (showNamesInTeamComments)
                        comments = comments + match[mapping["match"]["notes"]] + "    -" + match[mapping["match"]["scouter_name_key"]] + " (" + match[mapping["match"]["number_key"]] + ")\n\n"
                    else
                        comments = comments + match[mapping["match"]["notes"]] + " (Match " + match[mapping["match"]["number_key"]] + ")\n\n"
        }
        comments = comments.trim()
    } else comments = "No comments"

    // General Layout Assembly
    let holder = document.createElement("div")
    holder.className = "team-page-holder"

    let teamInfo = document.createElement("div")
    teamInfo.className = "team-info"
    holder.appendChild(teamInfo)

    //#region Team Info
    let basicInfo = document.createElement("div")
    basicInfo.className = "team-info-basic"
    teamInfo.appendChild(basicInfo)

    if (showTeamIcons) {
        let teamLogo = document.createElement("img")
        teamLogo.className = "logo-large"
        teamLogo.src = data.Icon
        basicInfo.appendChild(teamLogo)
    }

    let teamDescription = document.createElement("div")
    teamDescription.className = "team-info-description"
    basicInfo.appendChild(teamDescription)

    let teamName = document.createElement("div")
    teamName.className = "team-name"
    if (data.Name === undefined) teamName.innerText = data.Team_Number
    else teamName.innerText = data.Team_Number + " " + data.Name.substring(0, 20) + (data.Name.length > 20 ? "..." : "")
    teamName.title = data.Name
    teamDescription.appendChild(teamName)

    let pitImages = getPitScoutingImages(team)

    let tbaImageLength = usingTBAMedia ? data.TBA.images.length : 0

    let imageButton = document.createElement("button")
    imageButton.innerText = "View Media"
    imageButton.addEventListener("click", () => {
        document.querySelector(".sticky-header").hidden = true

        let bg = document.createElement("div")
        bg.className = "team-image-display-bg"
        document.body.appendChild(bg)

        let imageCycleCounter = document.createElement("div")
        imageCycleCounter.className = "team-image-display-counter"
        bg.appendChild(imageCycleCounter)

        let panel = document.createElement("div")
        panel.className = "team-image-display"

        let imageDisplay = document.createElement("div")
        imageDisplay.className = "team-image-display-holder"

        let imageIndex = 0

        function updateImage() {
            imageCycleCounter.innerText = "(" + (imageIndex+1) + "/" + (tbaImageLength+pitImages.length) + ")"
            imageDisplay.innerHTML = ""
            let media = imageIndex >= tbaImageLength ? pitImages[imageIndex - tbaImageLength] : data.TBA.images[imageIndex]
            if (imageIndex >= tbaImageLength) {
                let mediaHolder = document.createElement("img")
                mediaHolder.src = media
                imageDisplay.appendChild(mediaHolder)
            }
            if (media.type === "image") {
                let mediaHolder = document.createElement("img")
                mediaHolder.src = media.src
                imageDisplay.appendChild(mediaHolder)
            }
            if (media.type === "youtube") {
                let mediaHolder = document.createElement("iframe")
                mediaHolder.setAttribute("allow", "fullscreen")
                mediaHolder.src = "https://www.youtube.com/embed/" + media.src
                mediaHolder.width = "600"
                mediaHolder.height = "500"
                imageDisplay.appendChild(mediaHolder)
            }
        }

        if ((tbaImageLength + pitImages.length) > 1) {
            let leftButton = document.createElement("span")
            leftButton.innerText = "arrow_back"
            let rightButton = document.createElement("span")
            rightButton.innerText = "arrow_forward"
            leftButton.className = rightButton.className = "material-symbols-outlined"
            leftButton.addEventListener("click", () => {
                imageIndex--
                if (imageIndex < 0) imageIndex += tbaImageLength + pitImages.length
                updateImage()
            })
            rightButton.addEventListener("click", () => {
                imageIndex = (imageIndex + 1) % (tbaImageLength + pitImages.length)
                updateImage()
            })
            panel.appendChild(leftButton)
            panel.appendChild(imageDisplay)
            panel.appendChild(rightButton)
        } else panel.appendChild(imageDisplay)

        updateImage()

        bg.appendChild(panel)

        let closeImages = document.createElement("button")
        closeImages.innerText = "Close Media"
        closeImages.addEventListener("click", () => {
            bg.remove()
            document.querySelector(".sticky-header").hidden = false
        })
        bg.appendChild(closeImages)
    })

    if ((usingTBAMedia && tbaImageLength > 0) || pitImages.length > 0)
        teamDescription.appendChild(imageButton)

    let starEl = document.createElement("span")
    starEl.className = "material-symbols-outlined ar team-star"
    if (starred.includes(team)) starEl.classList.add("filled")
    starEl.onclick = function() {
        star(team)
        if (starred.includes(team)) starEl.classList.add("filled")
        else starEl.classList.remove("filled")
    }
    starEl.innerText = usingOffline ? starUnicode : "star"
    teamName.appendChild(starEl)

    let ignoreEl = document.createElement("span")
    ignoreEl.className = "material-symbols-outlined ar team-star ignore"
    if (ignored.includes(team)) ignoreEl.classList.add("filled")
    ignoreEl.onclick = function() {
        ignore(team)
        if (ignored.includes(team)) ignoreEl.classList.add("filled")
        else ignoreEl.classList.remove("filled")
    }
    ignoreEl.innerText = usingOffline ? crossOutUnicode : "block"
    teamName.appendChild(ignoreEl)

    if (usingTBA) {
        if (!projectorMode) {
            let teamDescriptionRemainder = document.createElement("div")
            teamDescriptionRemainder.innerText = "Rookie Year: " + data.TBA["rookie_year"] + "\n" + data.TBA["city"] + ", " + data.TBA["state_prov"]
            teamDescription.appendChild(teamDescriptionRemainder)
        }

        if (usingTBAMatches) {
            let matchSearch = document.createElement("input")
            matchSearch.addEventListener("focus", () => {
                brieflyDisableKeyboard = true
            })
            matchSearch.addEventListener("blur", () => {
                brieflyDisableKeyboard = false
            })

            let showMatchesEl = document.createElement("button")
            showMatchesEl.innerText = (maintainedTeamPageSettings.showMatches ? "Hide matches" : "Show Matches")
            showMatchesEl.addEventListener("click", () => {
                maintainedTeamPageSettings.showMatches = !maintainedTeamPageSettings.showMatches
                showMatchesEl.innerText = (maintainedTeamPageSettings.showMatches ? "Hide matches" : "Show Matches")
                matchSearch.classList.toggle("hidden")
                document.querySelector(".matches").classList.toggle("hidden")
                saveGeneralSettings()
                generateTeamMatches(data, team, matchSearch.value)
            })
            teamInfo.appendChild(showMatchesEl)

            matchSearch.placeholder = "Comma separated team search"
            matchSearch.onchange = matchSearch.onkeyup = matchSearch.oninput = function() {
                generateTeamMatches(data, team, matchSearch.value)
            }
            if (!maintainedTeamPageSettings.showMatches) matchSearch.classList.add("hidden")
            teamInfo.appendChild(matchSearch)
        }
    }

    let matches = document.createElement("div")
    matches.className = "matches"
    if (!maintainedTeamPageSettings.showMatches) matches.classList.add("hidden")
    teamInfo.appendChild(matches)

    //#endregion

    //#region Comparisons
    let compareHolder = document.createElement("div")
    compareHolder.className = "compare-holder"
    teamInfo.appendChild(compareHolder)

    let compareHeader = document.createElement("div")
    compareHeader.className = "compare-header"
    compareHolder.appendChild(compareHeader)

    let compareTitle = document.createElement("div")
    compareTitle.innerText = "Compare"
    compareHeader.appendChild(compareTitle)

    let addComparisonBtn = document.createElement("button")
    addComparisonBtn.innerText = "Add Team"
    addComparisonBtn.addEventListener("click", () => {
        if (usingDesmos && comparisons.length >= desmosColors.length - 1) {
            alert("Cannot have more than " + (desmosColors.length - 1) + " teams in comparison. Sorry!")
            return
        }
        let x = prompt("Search for a team").trim()
        if (x === null) return
        x = search(x).result
        if (comparisons.includes(x) || x === team) return
        if (team_data[x] !== undefined) {
            comparisons.push(x)
            addComparisonElement(x)
        }
        if (usingDesmos && data[graph] !== undefined)
            addGraph()

        tableTeams = JSON.parse(JSON.stringify(comparisons))
        tableTeams.push(team)
        regenTable()
    })
    compareHeader.appendChild(addComparisonBtn)

    for (let c of comparisons) {
        addComparisonElement(c)
    }

    function addComparisonElement(c) {
        let compareEl = document.createElement("div")
        compareEl.className = "compare-team"

        let visibility = document.createElement("span")
        visibility.className = "material-symbols-outlined ar team-compare-star"
        visibility.onclick = function() {
            if (hiddenCompares.includes(c)) hiddenCompares.splice(hiddenCompares.indexOf(c), 1)
            else hiddenCompares.push(c)
            openTeam(team, comparisons, hiddenCompares)
        }
        visibility.innerText = "visibility"
        if (hiddenCompares.includes(c)) visibility.innerText = "visibility_off"
        compareEl.appendChild(visibility)

        let starEl = document.createElement("span")
        starEl.className = "material-symbols-outlined ar team-compare-star"
        if (starred.includes(c)) starEl.classList.add("filled")
        starEl.onclick = function() {
            star(c)
            if (starred.includes(c)) starEl.classList.add("filled")
            else starEl.classList.remove("filled")
        }
        starEl.innerText = usingOffline ? starUnicode : "star"
        compareEl.appendChild(starEl)

        let ignoreEl = document.createElement("span")
        ignoreEl.className = "material-symbols-outlined ar team-compare-star ignore"
        if (ignored.includes(c)) ignoreEl.classList.add("filled")
        ignoreEl.onclick = function() {
            ignore(team)
            if (ignored.includes(team)) ignoreEl.classList.add("filled")
            else ignoreEl.classList.remove("filled")
        }
        ignoreEl.innerText = usingOffline ? crossOutUnicode : "block"
        compareEl.appendChild(ignoreEl)

        let compareTeamName = document.createElement("div")
        compareTeamName.innerText = c
        if (usingTBA) compareTeamName.innerText += " " + team_data[c].Name
        compareTeamName.className = "compare-team-name"
        compareTeamName.addEventListener("click", () => {
            comparisons.splice(comparisons.indexOf(c), 1, team)
            openTeam(c, comparisons)
        })
        compareEl.appendChild(compareTeamName)

        let deleteEl = document.createElement("span")
        deleteEl.className = "material-symbols-outlined ar team-compare-delete"
        deleteEl.onclick = function() {
            comparisons.splice(comparisons.indexOf(c), 1)
            compareEl.remove()
            addGraph()
        }
        deleteEl.innerText = "delete"
        compareEl.appendChild(deleteEl)

        compareHolder.appendChild(compareEl)
    }

    //#endregion

    //#region Team Data
    let teamData = document.createElement("div")
    teamData.className = "team-data"
    holder.appendChild(teamData)

    //#region Graph
    let graph = maintainedTeamPageSettings["graph"]
    if (graph === undefined && data.graphs !== undefined) graph = Object.keys(data.graphs)[0]

    let graphCommentsHolder = document.createElement("div")
    graphCommentsHolder.className = "graph-comments-holder"
    teamData.appendChild(graphCommentsHolder)

    let graphOverallHolder = document.createElement("div")
    if (usingDesmos && data[graph] !== undefined)
        graphCommentsHolder.appendChild(graphOverallHolder)

    let graphControls = document.createElement("div")
    graphControls.className = "graph-controls"
    graphOverallHolder.appendChild(graphControls)

    let graphSelectionsHolder = document.createElement("select")
    graphSelectionsHolder.className = "graph-selection-holder"
    graphSelectionsHolder.addEventListener("change", () => {
        graph = graphSelectionsHolder.value
        maintainedTeamPageSettings["graph"] = graph
        addGraph()
    })
    graphControls.appendChild(graphSelectionsHolder)

    if (data.graphs !== undefined)
        for (let graphOption of Object.keys(data.graphs)) {
            let goEl = document.createElement("option")
            goEl.innerText = graphOption.replaceAll("_", " ")
            goEl.value = graphOption
            goEl.className = "graph-option"
            if (graphOption === graph) goEl.setAttribute("selected", "selected")
            graphSelectionsHolder.appendChild(goEl)
        }

    let graphRefresh = document.createElement("button")
    graphRefresh.innerText = "Refresh Graph"
    graphRefresh.addEventListener("click", addGraph)
    graphControls.appendChild(graphRefresh)

    let graphHeight = maintainedTeamPageSettings["graphHeight"]
    let graphHolder = document.createElement("div")
    graphHolder.className = "graph initial"
    graphHolder.innerText = "Select something to graph"
    graphOverallHolder.appendChild(graphHolder)

    function addGraph() {
        if (!usingDesmos) return
        while (graphHolder.children.length > 0) graphHolder.children[0].remove()
        let graphData = [data.graphs[graph]]
        let graphTeams = [team]
        for (let team of comparisons) {
            if (!hiddenCompares.includes(team)) {
                graphData.push(team_data[team].graphs[graph])
                graphTeams.push(team)
            }
        }
        let teams = JSON.parse(JSON.stringify(comparisons))
        teams.unshift(team)
        graphHolder.innerText = ""
        graphHolder.classList.remove("initial")

        // noinspection JSSuspiciousNameCombination
        graphHolder.appendChild(graphElement(graphData, graph.replaceAll("_", " "), graphTeams, graphHeight, graphHeight))
    }
    if (usingDesmos && data.graphs !== undefined)
        addGraph()
    //#endregion

    //#region Comments & Pit Data
    let commentsHolder = document.createElement("div")
    let commentsTitle = document.createElement("div")
    let commentsEl = document.createElement("div")
    commentsHolder.className = "comments-holder"
    graphCommentsHolder.appendChild(commentsHolder)

    commentsTitle.className = "comments-title"
    commentsTitle.innerText = "Team Comments"
    commentsTitle.addEventListener("click", () => {
        commentsExpanded = !commentsExpanded
        commentsEl.hidden = !commentsExpanded
    })
    commentsHolder.appendChild(commentsTitle)
    if (!commentsExpanded)
        commentsEl.hidden = true

    commentsEl.className = "team-comments"
    if (!usingDesmos || data.graphs === undefined)
        commentsEl.classList.add("nograph")
    commentsEl.innerText = comments
    commentsHolder.appendChild(commentsEl)

    // Old pit scouting code
    if (false) {
        let pitDataTitle = document.createElement("div")
        pitDataTitle.className = "pit-data-title"
        pitDataTitle.innerText = "Pit Data"
        commentsHolder.appendChild(pitDataTitle)

        let pitDataHolder = document.createElement("div")
        pitDataHolder.className = "pit-data-holder"
        commentsHolder.appendChild(pitDataHolder)
        if (!pitDataExpanded)
            pitDataHolder.classList.add("hidden")

        pitDataTitle.addEventListener("click", () => {
            pitDataExpanded = !pitDataExpanded
            pitDataHolder.classList.toggle("hidden")
        })

        for (let x of pit_data) {
            let teamNum = x[mapping["pit_scouting"]["team"]["key"]]
            if (mapping["pit_scouting"]["format"] === "frc#") teamNum = teamNum.splice(0, 3)
            if (mapping["pit_scouting"]["format"] === "name") {
                for (let teamKey of Object.keys(team_data)) {
                    if (team_data[teamKey].Name.trim().toLowerCase() === teamNum.trim().toLowerCase()) teamNum = teamKey
                }
            }

            if (teamNum != team) continue

            for (let col of Object.keys(mapping["pit_scouting"]["page"])) {
                let el = document.createElement("div")
                el.className = "team-page-pit"

                let columnName = document.createElement("div")
                columnName.className = "team-page-pit-name"
                columnName.innerText = col
                el.appendChild(columnName)

                let columnData = document.createElement("div")
                columnData.className = "team-page-pit-data"
                columnData.innerText = col
                columnData.innerText = x[mapping["pit_scouting"]["page"][col]]
                el.appendChild(columnData)

                pitDataHolder.appendChild(el)
            }

            break
        }
    }

    //#endregion

    let teamTableHead = document.createElement("div")
    teamTableHead.className = "row table-head team-table b"
    teamData.appendChild(teamTableHead)

    let teamTable = document.createElement("div")
    teamTable.className = "table team-table"
    teamData.appendChild(teamTable)

    //#endregion

    //#region Resize Drag things (todo: come up with better name)

    let teamInfoWidth = maintainedTeamPageSettings["teamInfoWidth"]
    teamInfo.style.width = teamInfoWidth + "px"
    let teamInfoDrag = document.createElement("div")
    teamInfoDrag.className = "drag width"
    teamInfoDrag.addEventListener("mousedown", (e) => {
        let startX = e.x
        let startW = teamInfo.clientWidth
        document.body.addEventListener("mousemove", bodyMove)
        document.body.addEventListener("mouseup", bodyUp)
        function bodyMove(e) {
            teamInfoWidth = Math.min(startW - (startX - e.x), window.innerWidth / 2)
            teamInfo.style.width = teamInfoWidth + "px"
            teamInfoWidth = teamInfo.offsetWidth
            maintainedTeamPageSettings["teamInfoWidth"] = teamInfoWidth
            saveGeneralSettings()
            window.getSelection().removeAllRanges()
            restrictTable()
        }
        function bodyUp() {
            document.body.removeEventListener("mousemove", bodyMove)
            document.body.removeEventListener("mouseup", bodyUp)
            window.getSelection().removeAllRanges()
            restrictTable()
        }
    })
    holder.insertBefore(teamInfoDrag, teamData)

    function restrictTable() {
        teamTable.style.maxWidth = teamTableHead.style.maxWidth = (window.innerWidth - teamInfoWidth - 32) + "px"
    }
    restrictTable()

    graphHolder.style.width = graphHolder.style.height = graphHeight + "px"
    if (commentsEnabled) commentsHolder.style.maxHeight = Math.max(graphHeight, 374) + "px"
    let graphDrag = document.createElement("div")
    graphDrag.className = "drag height padding"
    graphDrag.addEventListener("mousedown", (e) => {
        let startY = e.y
        let startH = graphHolder.clientHeight
        if (!usingDesmos) startH = commentsEl.clientHeight
        document.body.addEventListener("mousemove", bodyMove)
        document.body.addEventListener("mouseup", bodyUp)
        graphHolder.innerHTML = ""
        e.preventDefault()
        function bodyMove(e) {
            graphHeight = Math.min(startH - (startY - e.y), window.innerHeight - document.querySelector(".sticky-header").clientHeight - 100)
            commentsHolder.style.maxHeight = graphHolder.style.width = graphHolder.style.height = graphHeight + "px"
            if (!usingDesmos) commentsHolder.style.minHeight = Math.max(graphHeight, 374) + "px"
            if (usingDesmos) graphHeight = graphHolder.offsetHeight
            else graphHeight = commentsEl.offsetHeight
            maintainedTeamPageSettings["graphHeight"] = graphHeight
            saveGeneralSettings()
            e.preventDefault()
            window.getSelection().removeAllRanges()
        }
        function bodyUp(e) {
            document.body.removeEventListener("mousemove", bodyMove)
            document.body.removeEventListener("mouseup", bodyUp)
            if (usingDesmos && data[graph] !== undefined)
                addGraph()
            saveGeneralSettings()
            e.preventDefault()
            window.getSelection().removeAllRanges()
        }
    })
    teamData.insertBefore(graphDrag, teamTableHead)

    //#endregion

    // Final Composition
    let backButton = document.createElement("button")
    backButton.className = "back-button"
    backButton.innerHTML = `<span class="material-symbols-outlined">arrow_back</span> Back to Table`
    backButton.addEventListener("click", closeTeam)
    el.appendChild(backButton)

    el.appendChild(holder)

    tableMode = "team"
    tableTeams = JSON.parse(JSON.stringify(comparisons))
    tableTeams.push(team)
    for (let x of hiddenCompares)
        tableTeams.splice(tableTeams.indexOf(x), 1)
    generateTeamMatches(data, team, "")
    setHeader()
    regenTable()

    document.querySelector(".table.team-table").addEventListener("scroll", () => {
        document.querySelector(".table-head.team-table").scrollLeft = document.querySelector(".table.team-table").scrollLeft
    })
}
function closeTeam() {
    document.querySelector(".table.main-table").classList.remove("hidden")
    document.querySelector(".table-head.main-table").classList.remove("hidden")
    document.querySelector(".team-page").innerText = ""
    tableMode = "main"
    openedTeam = undefined
    regenTable()
    setHeader()
}

function generateTeamMatches(data, team, teamsWith) {
    while(document.querySelector(".matches").children.length > 0)
        document.querySelector(".matches").children[0].remove()

    let skipTeamCheck = (teamsWith === undefined || teamsWith.trim() === "")
    if (!skipTeamCheck) {
        teamsWith = teamsWith.trim().split(",")
        let actualTeamsWith = []
        for (let x of teamsWith) {
            if (search(x).distance < 10) actualTeamsWith.push(search(x).result)
        }
        teamsWith = actualTeamsWith
    }

    if (usingTBA && usingTBAMatches) {
        let upcoming = false
        for (let match of Object.keys(data.TBA.matches)) {
            let mEl = document.createElement("div")
            mEl.className = "match"

            let matchData = data.TBA.matches[match]
            let alliance = matchData["alliances"]["blue"]["team_keys"].includes(data.TBA.key) ? "blue" : "red"

            if (matchData["alliances"]["blue"]["score"] === -1 && !upcoming) {
                let upcomingEl = document.createElement("div")
                upcomingEl.className = "matches-upcoming-label"
                upcomingEl.innerText = "Awaiting Results"

                upcoming = true
                document.querySelector(".matches").appendChild(upcomingEl)
            }

            //#region Children

            let matchNumber = document.createElement("div")
            matchNumber.className = "match-number"
            mEl.appendChild(matchNumber)
            if (data.TBA.matches[match]["videos"].length > 0 && data.TBA.matches[match]["videos"][0].type === "youtube") {
                let matchNumberText = document.createElement("a")
                matchNumberText.innerText = match
                matchNumberText.setAttribute("target", "_blank")
                matchNumberText.setAttribute("rel", "noopener noreferrer")
                matchNumberText.href = "https://www.youtube.com/watch?v=" + data.TBA.matches[match]["videos"][0]["key"]
                matchNumber.appendChild(matchNumberText)
            } else {
                let matchNumberText = document.createElement("div")
                matchNumberText.innerText = match
                matchNumber.appendChild(matchNumberText)
            }

            let icon = "skull" // Lose
            if (upcoming) icon = "schedule"
            else if (matchData["winning_alliance"] === alliance) icon = "trophy" // Win
            else if (matchData["winning_alliance"] === "") icon = "balance" // Tie

            let iconEl = document.createElement("span")
            iconEl.className = "material-symbols-outlined"
            iconEl.innerText = icon
            matchNumber.classList.add(icon)
            matchNumber.appendChild(iconEl)

            let firstAlliance = document.createElement("div")
            firstAlliance.className = "match-alliance " + alliance
            for (let t of matchData["alliances"][alliance]["team_keys"]) {
                let tEl = document.createElement("div")
                tEl.innerText = t.replace("frc", "")
                if (teamsWith.includes(t.replace("frc", ""))) tEl.style.fontWeight = "bold"
                if (t.replace("frc", "") === team) tEl.style.order = "-10000"
                firstAlliance.appendChild(tEl)
            }
            mEl.appendChild(firstAlliance)

            let secondAlliance = document.createElement("div")
            secondAlliance.className = "match-alliance " + (alliance === "blue" ? "red" : "blue")
            for (let t of matchData["alliances"][(alliance === "blue" ? "red" : "blue")]["team_keys"]) {
                let tEl = document.createElement("div")
                if (teamsWith.includes(t.replace("frc", ""))) tEl.style.fontWeight = "bold"
                tEl.innerText = t.replace("frc", "")
                secondAlliance.appendChild(tEl)
            }
            mEl.appendChild(secondAlliance)

            if (icon === "schedule") mEl.title = "Awaiting Results"
            else mEl.title = icon.replace("skull", "Lost").replace("trophy", "Won").replace("balance", "Tie")
                + " " + matchData["alliances"][alliance]["score"] + " | " + matchData["alliances"][(alliance === "blue" ? "red" : "blue")]["score"]
            //#endregion

            let teams = matchData["alliances"]["blue"]["team_keys"].concat(matchData["alliances"]["red"]["team_keys"])
            for (let t in teams) teams[t] = teams[t].replace("frc", "")

            if (skipTeamCheck) document.querySelector(".matches").appendChild(mEl)
            else {
                let containsTeam = false
                for (let t of teamsWith)
                    if (teams.includes(t.trim())) containsTeam = true
                if (containsTeam)
                    document.querySelector(".matches").appendChild(mEl)
            }
        }
    }
    else {
        let mEl = document.createElement("div")
        mEl.innerText = "Matches: "
        mEl.className = "match"
        for (let match of Object.keys(data.matches)) {
            mEl.innerText += data.matches[match][mapping["match"]["number_key"]] + ", "
        }
        mEl.innerText = mEl.innerText.substring(0, mEl.innerText.length - 2)
        document.querySelector(".matches").appendChild(mEl)
    }
}

function graphElement(data, name, teams, width, height) {
    let el = document.createElement("div")
    el.style.width = width === undefined ? "500px" : width + "px"
    el.style.height = height === undefined ? "500px" : height + "px"
    let calc = Desmos.GraphingCalculator(el, {expressions: false, settingsMenu: false, xAxisLabel: "Matches", yAxisLabel: name, zoomButtons: false, lockViewport: false, })

    setGraphColors()

    function numArrToStrArr(numArr) {
        let strArr = []
        for (let n of numArr) strArr.push(n.toString())
        return strArr
    }

    let minY = 0
    let maxY = 0
    let maxX = 0
    for (let team of data)
        if (graphSettings.x === "relative") {
            let teamKeys = Object.keys(team)
            for (let x in teamKeys) {
                if (team[teamKeys[x]] > maxY) maxY = team[teamKeys[x]]
                if (parseFloat(x) > maxX) maxX = x
                if (team[teamKeys[x]] < minY) minY = team[teamKeys[x]]
            }
        } else
            for (let x of Object.keys(team)) {
                if (team[x] > maxY) maxY = team[x]
                if (parseFloat(x) > maxX) maxX = x
                if (team[x] < minY) minY = team[x]
            }

    calc.setMathBounds({
        left: maxX * -.05,
        right: maxX * 1.2,
        bottom: maxY * -.05,
        top: maxY * 1.2
    })

    let expressions = []
    expressions.push({
        latex: "T_{eamListX}=" + (maxX * 1.15)
    })
    expressions.push({
        latex: "T_{eamListY}=" + (1.2 * maxY - maxY * .05)
    })
    for (let i = 0; i < data.length; i++) {
        if (teams[i] === undefined) continue

        if (graphSettings.x === "relative") {
            let xAxis = []
            for (let x in Object.keys(data[i])) xAxis.push(x)
            expressions.push({
                type:"table",
                columns: [
                    {latex: "x_{" + i + "}", values: numArrToStrArr(xAxis)},
                    {latex: "y_{" + i + "}", values: numArrToStrArr(Object.values(data[i])), hidden: true},
                ]
            })
        }
        else expressions.push({
            type:"table",
            columns: [
                {latex: "x_{" + i + "}", values: numArrToStrArr(Object.keys(data[i]))},
                {latex: "y_{" + i + "}", values: numArrToStrArr(Object.values(data[i])), hidden: true},
            ]
        })

        let teamName = ""
        if (usingTBA) teamName = team_data[teams[i]].Name

        expressions.push({latex: "y_{" + i + "}\\sim a_{" + i + "}x_{" + i + "} + b_{" + i + "}", hidden: true})

        let pointOffset = projectorMode ? .075 : .05

        if (graphSettings.bestfit)
            expressions.push({latex: "a_{" + i + "}" + "x + " + "b_{" + i + "}" + " = y", color: desmosColors[i], lineWidth: (projectorMode ? 12 : 6), lineOpacity: (projectorMode ? .8 : .6), label: teams[i] + " " + teamName})
        expressions.push({
            latex: "(T_{eamListX},T_{eamListY}-" + (i * pointOffset * maxY) + ")",
            label: teams[i] + " " + teamName.substring(0, 20) + (teamName.length >= 20 ? "..." : ""),
            showLabel: true,
            labelOrientation: Desmos.LabelOrientations.LEFT,
            color: desmosColors[i],
            labelSize: (projectorMode ? "1.5" : "1"),
            pointSize: (projectorMode ? 24 : 16),
            pointStyle: Desmos.Styles.OPEN,
            dragMode: Desmos.DragModes.NONE
        })
        expressions.push({
            latex: "\\left(T_{eamListX},T_{eamListY}-" + (i * pointOffset * maxY) + "\\right)",
            pointOpacity: 0,
            color: Desmos.Colors.BLACK,
            dragMode: Desmos.DragModes.XY
        })
        if (graphSettings.points)
            expressions.push({
                latex: "(x_{" + i + "}, y_{" + i + "})",
                color: desmosColors[i],
                label: teams[i] + " (${x_{" + i + "}},${y_{" + i + "}})",
                labelSize: (projectorMode ? "1.5" : "1"),
                pointSize: (projectorMode ? 22 : 11),
            })
    }

    calc.setExpressions(expressions);
    return el
}

document.querySelector("#top-show-hide-comment-names").onclick = function() {
    showNamesInTeamComments = !showNamesInTeamComments
    if (openedTeam !== undefined) openTeam(openedTeam)
    document.querySelector("#top-show-hide-comment-names").innerText = "Names in Comments: " + (showNamesInTeamComments ? "Shown" : "Hidden")
    saveGeneralSettings()
}

document.querySelector("#top-graph-x").addEventListener("click", () => {
    graphSettings.x = graphSettings.x === "relative" ? "absolute" : "relative"

    document.querySelector("#top-graph-x").innerText = "X Axis: " + (graphSettings.x === "relative" ? "Relative" : "Absolute")

    saveGeneralSettings()
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
})

function search(input) {
    input = input.replace(/\s/g, "").toLowerCase()

    // Copied from geeksforgeeks.org implementation for Levenstein Distance using Iterative with the full matrix approach
    function levenshtein(str1, str2) {
        const m = str1.length;
        const n = str2.length;

        const dp = new Array(m + 1).fill(null).map(() => new Array(n + 1).fill(0));

        // Initialize the first row
        // and column of the matrix
        for (let i = 0; i <= m; i++) {
            dp[i][0] = i;
        }
        for (let j = 0; j <= n; j++) {
            dp[0][j] = j;
        }

        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                if (str1[i - 1] === str2[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1];
                } else {
                    dp[i][j] = 1 + Math.min(
                        // Insert
                        dp[i][j - 1],
                        Math.min(
                            // Remove
                            dp[i - 1][j],
                            // Replace
                            dp[i - 1][j - 1]
                        )
                    );
                }
            }
        }
        return dp[m][n];
    }

    let distance = Math.pow(10, 10)
    let team
    for (let teamNum of Object.keys(team_data)) {
        let teamName
        if (usingTBA)
            teamName = team_data[teamNum].Name.replace(/\s/g, "").toLowerCase()
        if (teamNum == input) {
            team = teamNum
            distance = 0
            break
        }
        else if (usingTBA && teamName === input) {
            team = teamNum
            distance = 0
            break
        }
        else if (usingTBA) {
            let teamDistance = levenshtein(input, teamName)
            if (teamDistance < distance) {
                distance = teamDistance
                team = teamNum
            }
        }
    }

    return {
        "result": team,
        "distance": distance,
        "input": input
    }
}

document.querySelector("#search-4915").addEventListener("keyup", handleSearchbar)
function handleSearchbar(event) {
    let result = search(document.querySelector("#search-4915").value)
    if (result.distance > 10 || result.input === "") {
        document.querySelector("#search-4915-result").innerText = ""
        document.querySelector("#search-open").hidden = true
        document.querySelector("#search-star").hidden = true
        document.querySelector("#search-ignore").hidden = true
        return
    }
    document.querySelector("#search-open").hidden = false
    document.querySelector("#search-star").hidden = false
    document.querySelector("#search-star").innerText = starred.includes(result.result) ? "Unstar" : "Star"
    document.querySelector("#search-ignore").hidden = false
    document.querySelector("#search-ignore").innerText = ignored.includes(result.result) ? "Unignore" : "Ignore"
    if (usingTBA)
        document.querySelector("#search-4915-result").innerText = team_data[result.result].Name

    if (event !== undefined && event.code === "Enter") {
        openTeam(result.result)
        document.querySelector("#search-4915").value = ""
        handleSearchbar()
    }
}
document.querySelector("#search-4915").addEventListener("focus", () => {
    brieflyDisableKeyboard = true
})
document.querySelector("#search-4915").addEventListener("blur", () => {
    brieflyDisableKeyboard = false
})

document.querySelector("#search-open").addEventListener("click", () => {
    openTeam(search(document.querySelector("#search-4915").value).result)
    document.querySelector("#search-4915").value = ""
    handleSearchbar()
})
document.querySelector("#search-star").addEventListener("click", () => {
    star(search(document.querySelector("#search-4915").value).result)
    handleSearchbar()
})
document.querySelector("#search-ignore").addEventListener("click", () => {
    ignore(search(document.querySelector("#search-4915").value).result)
    handleSearchbar()
})

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
    let key = e.key.toLowerCase()
    if (key === "d" || key === "arrowright") {
        let currentIndex = columns.indexOf(selectedSort)
        if (currentIndex !== columns.length-1) {
            if (e.shiftKey) {
                columns[currentIndex] = columns[currentIndex+1]
                columns[currentIndex+1] = selectedSort
            } else changeSort(columns[currentIndex+1])
        }
        e.preventDefault()
    }
    if (key === "a" || key === "arrowleft") {
        let currentIndex = columns.indexOf(selectedSort)
        if (currentIndex !== 0) {
            if (e.shiftKey) {
                columns[currentIndex] = columns[currentIndex-1]
                columns[currentIndex-1] = selectedSort
            } else changeSort(columns[currentIndex-1])
        }
        e.preventDefault()
    }
    if (key === "w") sortDirection = 1
    if (key === "s") sortDirection = -1
    if (key === " ") {
        sortDirection *= -1
        e.preventDefault()
    }
    if (key === "control") controlPressed = true
    if (key === "p") {
        projectorMode = !projectorMode
        setProjectorModeSheet()
    }
    if (key === "1") selectedSort.size = 0
    if (key === "2") selectedSort.size = 1
    if (key === "3") selectedSort.size = 2
    if (key === "4") selectedSort.size = 3
    setHeader()
    saveColumns()
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
            saveColumns()
            setHeader()
            regenTable()
        })
        options.appendChild(option)
    }

    if (tableMode === "team")
        optionEl("Back to Table", closeTeam)

    let context = e.target.getAttribute("data-context")
    if (context === "star") {
        optionEl("Star All", () => {
            for (let x in team_data) set_star(x, true, false)
        })
        optionEl("Unstar All", () => {
            for (let x in team_data) set_star(x, false, false)
        })
        optionEl("Flip starred teams", () => {
            for (let x in team_data) star(x)
        })
        if (6 >= starred.length && starred.length > 1)
            optionEl("Compare Starred Teams", () => {
                openTeam(starred[0], starred.slice(1,starred.length))
            })
    }
    if (context === "ignore") {
        optionEl("Ignore All", () => {
            for (let x in team_data) set_ignore(x, true, false)
        })
        optionEl("Unignore All", () => {
            for (let x in team_data) set_ignore(x, false, false)
        })
        optionEl("Flip ignored teams", () => {
            for (let x in team_data) ignore(x)
        })
        if (showIgnoredTeams)
            optionEl("Hide ignored teams", () => {
                showIgnoredTeams = false
                usingIgnore = true
                regenTable()
                saveGeneralSettings()
            })
        else
            optionEl("Show ignored teams", () => {
                showIgnoredTeams = true
                regenTable()
                saveGeneralSettings()
            })
    }
    if (context === "icon-column") {
        optionEl("Hide icons", () => {
            showTeamIcons = false
            saveGeneralSettings()
        })
    }
    if (context === "column") {
        let column = parseInt(e.target.getAttribute("data-context-index"))
        optionEl("Hide column", () => {
            columns.splice(column, 1)
        })
        if (column !== 0)
            optionEl("<- Move left", () => {
                let c = columns[column - 1]
                columns[column - 1] = columns[column]
                columns[column] = c
            })
        if (column !== columns.length - 1)
            optionEl("Move right ->", () => {
                let c = columns[column + 1]
                columns[column + 1] = columns[column]
                columns[column] = c
            })

        let makeTiny = document.createElement("button")
        makeTiny.className = "context-option"
        makeTiny.innerText = "Tiny"
        makeTiny.addEventListener("click", () => {
            columns[column].size = 0
            saveColumns()
            setHeader()
        })
        options.appendChild(makeTiny)

        let makeRegular = document.createElement("button")
        makeRegular.className = "context-option"
        makeRegular.innerText = "Regular"
        makeRegular.addEventListener("click", () => {
            columns[column].size = 1
            saveColumns()
            setHeader()
        })
        options.appendChild(makeRegular)

        let makeLarge = document.createElement("button")
        makeLarge.className = "context-option"
        makeLarge.innerText = "Large"
        makeLarge.addEventListener("click", () => {
            columns[column].size = 2
            saveColumns()
            setHeader()
        })
        options.appendChild(makeLarge)

        let makeMassive = document.createElement("button")
        makeMassive.className = "context-option"
        makeMassive.innerText = "Massive"
        makeMassive.addEventListener("click", () => {
            columns[column].size = 3
            saveColumns()
            setHeader()
        })
        options.appendChild(makeMassive)

    }
    if (context === null && tableMode !== "team") {
        contextMenu.setAttribute("empty", "empty")
    }
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

let viewingRobots = false
function hideRobotView() {
    document.querySelector(".sticky-header").classList.remove("hidden")
    if (tableMode === "team")
        document.querySelector(".team-page").classList.remove("hidden")
    else {
        document.querySelector(".table.main-table").classList.remove("hidden")
        document.querySelector(".table-head.main-table").classList.remove("hidden")
    }

    document.querySelector(".robot-view").classList.add("hidden")
}
document.querySelector("#top-pictures").addEventListener("click", () => {
    if (viewingRobots) hideRobotView()
    else {
        document.querySelector(".robot-view").classList.toggle("hidden")

        document.querySelector(".team-page").classList.add("hidden")
        document.querySelector(".table.main-table").classList.add("hidden")
        document.querySelector(".table-head.main-table").classList.add("hidden")

        document.querySelector(".robot-view").classList.remove("hidden")
    }
    viewingRobots = !viewingRobots

    if (viewingRobots) viewRobots()
})

function viewRobots() {
    let robotView = document.querySelector(".robot-view")
    robotView.innerHTML = ""

    let robotViewControls = document.createElement("div")
    robotViewControls.className = "robot-view-top-controls"
    robotView.appendChild(robotViewControls)

    let toggleIgnored = document.createElement("button")
    toggleIgnored.innerText = "Ignored Teams: " + (robotViewScope.ignored === 0 ? "Mixed in" : (robotViewScope.ignored === 1 ? "Bottom" : "Hidden"))
    toggleIgnored.addEventListener("click", () => {
        robotViewScope.ignored = ((robotViewScope.ignored + 2) % 3) - 1
        viewRobots()
    })
    robotViewControls.appendChild(toggleIgnored)

    let toggleStarred = document.createElement("button")
    toggleStarred.innerText = "Starred Teams: " + (robotViewScope.starred === 0 ? "Mixed in" : (robotViewScope.starred === 1 ? "Top" : "Hidden"))
    toggleStarred.addEventListener("click", () => {
        robotViewScope.starred = ((robotViewScope.starred + 2) % 3) - 1
        viewRobots()
    })
    robotViewControls.appendChild(toggleStarred)

    let toggleTheRest = document.createElement("button")
    toggleTheRest.innerText = "Other Teams: " + (robotViewScope.normal === 1 ? "Shown" : "Hidden")
    toggleTheRest.addEventListener("click", () => {
        robotViewScope.normal *= -1
        viewRobots()
    })
    robotViewControls.appendChild(toggleTheRest)

    for (let team of Object.keys(team_data)) {
        let teamEl = document.createElement("div")
        teamEl.className = "robot-view-team"

        let images = [...getPitScoutingImages(team), ...(usingTBAMedia ? team_data[team].TBA.images : [])]
        if (images.length === 0) continue

        if (starred.includes(team)) {
            if (robotViewScope.starred === -1) continue
        }
        else if (ignored.includes(team)) {
            if (robotViewScope.ignored === -1) continue
        } else if (robotViewScope.normal === -1) continue
        robotView.appendChild(teamEl)

        let order = 0
        if (starred.includes(team) && robotViewScope.starred === 1) order = -5
        if (ignored.includes(team) && robotViewScope.ignored === 1) order = 5
        teamEl.style.order = ""+order

        let doneFirstLoad = false

        let image = document.createElement("img")
        image.className = "robot-view-image"
        image.src = images[0]
        image.addEventListener("load", () => {
            if (!doneFirstLoad)
                if (image.width > image.height) order += "1"
            teamEl.style.order = ""+order
            doneFirstLoad = true
        })
        image.addEventListener("click", () => {
            openTeam(team)
        })
        teamEl.appendChild(image)

        let teamDetails = document.createElement("div")
        teamDetails.className = "robot-view-details"

        let teamNameNumber = document.createElement("div")
        teamNameNumber.className = "robot-view-name-number"
        teamDetails.appendChild(teamNameNumber)

        let teamNumber = document.createElement("div")
        teamNumber.className = "robot-view-number"
        teamNumber.innerText = team
        teamNameNumber.appendChild(teamNumber)

        let teamName = document.createElement("div")
        teamName.className = "robot-view-name"
        teamName.innerText = team_data[team].Name
        teamNameNumber.appendChild(teamName)

        teamEl.appendChild(teamDetails)

        let teamControls = document.createElement("div")
        teamControls.className = "robot-view-controls"

        let teamMainControls = document.createElement("div")
        teamMainControls.className = "robot-view-control-section"
        teamControls.appendChild(teamMainControls)

        let starEl = document.createElement("span")
        starEl.className = "material-symbols-outlined ar star"
        if (starred.includes(team)) starEl.classList.add("filled")
        starEl.onclick = () => {
            star(team)
            starEl.classList.toggle("filled")
            viewRobots()
        }
        starEl.innerText = usingOffline ? starUnicode : "star"
        teamMainControls.appendChild(starEl)

        let ignoreEl = document.createElement("span")
        ignoreEl.className = "material-symbols-outlined ar ignore"
        if (ignored.includes(team)) ignoreEl.classList.add("filled")
        ignoreEl.onclick = () => {
            ignore(team)
            ignoreEl.classList.toggle("filled")
            viewRobots()
        }
        ignoreEl.innerText = usingOffline ? crossOutUnicode : "block"
        teamMainControls.appendChild(ignoreEl)

        teamDetails.appendChild(teamControls)

        // Swap image
        let imageIndex = 0

        let leftButton = document.createElement("span")
        leftButton.innerText = "arrow_back"
        leftButton.className = "material-symbols-outlined"
        leftButton.addEventListener("click", () => {
            imageIndex--
            setImage(-1)
        })

        let carouselProgress = document.createElement("span")

        let rightButton = document.createElement("span")
        rightButton.innerText = "arrow_forward"
        rightButton.className = "material-symbols-outlined"
        rightButton.addEventListener("click", () => {
            imageIndex++
            setImage(1)
        })

        let imageLength = 0
        for (let image of images)
            if (typeof image === "object") {
                if (image.type === "image") imageLength++
            } else imageLength++

        if (imageLength > 1) {
            let imageCarouselControls = document.createElement("div")
            imageCarouselControls.className = "robot-view-control-section"

            imageCarouselControls.appendChild(leftButton)
            imageCarouselControls.appendChild(carouselProgress)
            imageCarouselControls.appendChild(rightButton)
            teamControls.appendChild(imageCarouselControls)
        }

        function setImage(direction) {
            if (imageIndex < 0) imageIndex += images.length
            imageIndex = (imageIndex) % images.length

            if (typeof images[imageIndex] === "object") {
                if (images[imageIndex].type === "image") {
                    image.src = images[imageIndex].src
                    image.alt = images[imageIndex].src
                }
                if (images[imageIndex].type === "youtube") {
                    imageIndex += direction
                    setImage(direction)
                }
            } else image.src = images[imageIndex]

            carouselProgress.innerText = (imageIndex+1) + "/" + imageLength
        }
        setImage()
    }
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
localforage.getItem(COLUMNS, (err, val) => {
    if (val !== null) columns = val
    if (!--initLoading) finishInit()
})

setProjectorModeSheet()

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

function finishInit() {
    // Welcome Checklist
    doingInitialSetup = false
    function welcomeChecklistItem(name, checked) {
        let el = document.createElement("div")
        el.className = "welcome-item"
        let icon = document.createElement("span")
        icon.className = "material-symbols-outlined"
        icon.innerText = (checked ? "check_circle" : "radio_button_unchecked")
        el.appendChild(icon)
        let text = document.createElement("div")
        text.innerText = name
        el.appendChild(text)
        document.querySelector(".welcome").appendChild(el)
        if (!checked) doingInitialSetup = true
    }
    document.querySelector("#setup-checklist-title").innerText = toolName + " Setup Checklist"
    document.querySelector("#welcome-hide").addEventListener("click", () => {
        document.querySelector(".welcome").remove()
    })
    welcomeChecklistItem("The Blue Alliance API Key", !usingTBA || tbaKey)
    welcomeChecklistItem("Select an Event", !usingTBA || eventKey)
    welcomeChecklistItem("Upload a mapping for your data", mapping)

    let hasData = false
    for (let val of Object.values(uploadedData))
        if (val !== {}) hasData = true
    welcomeChecklistItem("Upload your scouting data", hasData)
    if (!doingInitialSetup)
        document.querySelector(".welcome").remove()

    // View robots
    if (usingTBAMedia || (mapping["pit_scouting"] !== undefined && mapping["pit_scouting"]["image"] !== undefined)) {
        document.querySelector("#top-pictures").disabled = false
    }

    // Final Prep
    setColumnOptions()
    selectedSort = columns[0]
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
