'use strict';

class Table extends Widget {
    constructor() {
        super();
        this.name = "Table"

        this.columns = []
        this.teams = []
        this.activeColumn = ""
        this.sort = 1

        // FIXME maybe not?
        this.showMultipleTimes = true

        /**
         * Are all teams shown or just those with a list enabled in the table's scope?
         */
        this.showAll = true
        this.scope = {}
        this.scope[ignore.id] = List.Sort.HIDE // FIXME remove this - for testing purposes

        for (let list of Lists.lists) {
            this.scope[list.id] = {
                "sort": null, // If sort == null, it defaults to the default for that id.
                "shown": true,
            }
        }
        Events.on(Events.LIST_CHANGE, this.sortRows, this)

        this.content.classList.add("table")

        this.header = document.createElement("div")
        this.header.classList.add("row", "header")
        this.content.appendChild(this.header)

        let teamSettingsBlock = document.createElement("div")
        teamSettingsBlock.className = "table-settings-block"
        teamSettingsBlock.setAttribute("data-id", this.id)
        this.header.appendChild(teamSettingsBlock)

        let teamFilterButton = document.createElement("button")
        teamFilterButton.className = "table-setting material-symbols-outlined"
        teamFilterButton.innerText = "view_agenda"
        teamSettingsBlock.appendChild(teamFilterButton)

        this.columnDragIndicator = document.createElement("div")
        this.columnDragIndicator.className = "data-drag-indicator"
        this.columnDragIndicator.style.order = "-99"
        this.header.appendChild(this.columnDragIndicator)

        if (usingTBAMedia) {
            let logoPlaceholder = document.createElement("div")
            logoPlaceholder.className = "table-logo placeholder"
            this.header.appendChild(logoPlaceholder)
            console.log(logoPlaceholder)
            this.hasAddedMedia = true
        }

        this.aboveDivider = document.createElement("div")
        this.aboveDivider.className = "divider-above hidden"
        this.content.appendChild(this.aboveDivider)

        this.belowDivider = document.createElement("div")
        this.belowDivider.className = "divider-below hidden"
        this.content.appendChild(this.belowDivider)

        this.minWidth = 400
        this.minHeight = 280
    }
    addColumn(...[columns]) {
        if (typeof columns !== "object") columns = [columns]
        for (let id of columns) {
            let column = getColumnFromID(id)

            this.columns.push({
                columnId: column.id,
                name: column.name,
                mapping: column.mapping,
                size: 110, // Pixels
                data: column.data,
                order: this.columns.length, // Left to right
                toString() {
                    return "Column with id " + this.columnId
                }
            })
            let thisColumn = this.columns[this.columns.length - 1]

            for (let team of this.teams) {
                let dataEl = document.createElement("div")
                dataEl.className = "data"
                dataEl.setAttribute("data-column", column.id)
                dataEl.setAttribute("data-team", team)
                dataEl.setAttribute("data-id", this.id)

                let value = typeof column.data[team] === "object" ? column.data[team]["summarized"] : column.data[team]
                if (typeof value === "number") dataEl.innerText = (Math.round(value * rounding) / rounding) + ""
                else dataEl.innerText = value
                document.querySelector(`.row[data-team="${team}"][data-id="${this.id}"]`).appendChild(dataEl)
            }

            let headerEl = document.createElement("div")
            headerEl.className = "data header"
            headerEl.setAttribute("data-column", column.id)
            headerEl.setAttribute("data-id", this.id)
            headerEl.innerText = column.name
            headerEl.addEventListener("click", () => {
                this.setActiveColumn(column.id)
            })
            this.header.appendChild(headerEl)

            //#region Resizing
            let colResizer = document.createElement("div")
            colResizer.className = "data-resizer"
            colResizer.setAttribute("data-column-size", column.id)
            colResizer.setAttribute("data-id", this.id)
            let resizing = false
            let index
            colResizer.addEventListener("mousedown", () => {
                resizing = true
                index = this.indexOfColumn(column.id)
            })
            document.body.addEventListener("mousemove", (e) => {
                if (!resizing) return
                this.columns[index].size = Math.max(this.columns[index].size + e.movementX, 70)
                e.preventDefault()
                window.getSelection().empty()
                this.refresh()
                this.setTextSizes(this.columns[index])
            })
            document.body.addEventListener("mouseup", () => resizing = false)
            document.body.addEventListener("mouseleave", () => resizing = false)
            this.header.appendChild(colResizer)
            //#endregion

            //#region Dragging
            //FIXME Cannot drag column to be the first one when widget does not occupy whole width and is on the left side of screen
            let colDragger = document.createElement("div")
            colDragger.className = "data-dragger material-symbols-outlined"
            colDragger.setAttribute("data-column-drag", column.id)
            colDragger.setAttribute("data-id", this.id)
            colDragger.innerText = "drag_indicator"

            let dragging = false
            let dragData
            let dragRemovalEl
            colDragger.addEventListener("mousedown", (e) => {
                dragData = {
                    column: null,
                    insertBefore: null,
                }
                dragging = true
                colDragger.classList.add("dragging")
                for (let col of this.columns) col.order *= 2
                dragRemovalEl = document.createElement("div")
                dragRemovalEl.className = "table-column-drag-remove material-symbols-outlined"
                dragRemovalEl.innerText = "delete"
                dragRemovalEl.style.left = (e.clientX - getRem(2)) + "px"
                dragRemovalEl.style.top = (e.clientY + getRem(3)) + "px"
                this.content.appendChild(dragRemovalEl)
                this.refresh()
            })
            document.body.addEventListener("mousemove", (e) => {
                if (!dragging) return

                let column = this.getColumnById(e.target.getAttribute("data-column"))
                let insertBefore = e.target.offsetLeft + e.target.offsetWidth / 2 > e.clientX
                if (column === null) return

                if (insertBefore) this.columnDragIndicator.style.order = ((column.order * 2) + 99) + ""
                else this.columnDragIndicator.style.order = ((column.order * 2) + 101) + ""

                dragData = {
                    "column": column,
                    insertBefore
                }
            })
            document.body.addEventListener("mouseleave", () => {
                dragging = false
                this.columnDragIndicator.style.order = "-999"
                if (dragRemovalEl !== undefined) {
                    dragRemovalEl.remove()
                    dragRemovalEl = undefined
                }
            })
            document.body.addEventListener("mouseup", (e) => {
                if (!dragging) return
                dragging = false
                this.columnDragIndicator.style.order = "-999"

                if (dragData.column !== null) {
                    let removalBounds = dragRemovalEl.getBoundingClientRect()
                    if (removalBounds.left < e.clientX && e.clientX < removalBounds.right && removalBounds.top < e.clientY && e.clientY < removalBounds.bottom) {
                        this.removeColumn(thisColumn.columnId)
                    } else {
                        if (dragData.insertBefore) {
                            thisColumn.order = dragData.column.order - 1
                        } else {
                            thisColumn.order = dragData.column.order + 1
                        }
                    }
                }

                if (dragRemovalEl !== undefined) {
                    dragRemovalEl.remove()
                    dragRemovalEl = undefined
                }

                this.refresh()
            })
            //#endregion

            headerEl.appendChild(colDragger)
        }

        if (this.activeColumn === "") this.setActiveColumn(this.columns[0].columnId)

        this.refresh()
    }
    removeColumn(...[columns]) {
        if (typeof columns !== "object") columns = [columns]
        for (let col of columns) {
            let column = col
            if (typeof col === "string") column = this.getColumnById(col)

            this.columns.splice(this.indexOfColumn(column), 1)

            document.querySelector(`[data-column-size="${column.columnId}"][data-id="${this.id}"]`).remove()
            document.querySelector(`[data-column="${column.columnId}"][data-id="${this.id}"]`).remove()

            this.hardRefresh()

            if (this.activeColumn === column.columnId) {
                this.activeColumn = "" // Stops the setActiveFunction function from trying to change the element
                this.setActiveColumn(this.columns[0].columnId)
            }
        }
    }
    setColumns(...[columns]) {
        if (typeof columns !== "object") columns = [columns]
        this.removeColumn(this.columns)
        this.addColumn(columns)
    }
    getColumnById(id) {
        for (let col of this.columns)
            if (col.columnId === id) return col
        return null
    }
    addTeam(...[teams]) {
        if (typeof teams !== "object") teams = [teams]
        for (let team of teams) {
            this.teams.push(team)
            this.addTeamEl(team)
        }

        this.sortRows()
        this.refresh()
    }
    addTeamEl(...[teams]) {
        if (typeof teams !== "object") teams = [teams]
        for (let team of teams) {
            let existingEl = document.querySelector('.row[data-id="' + this.id + '"][data-team="'+ team + '"]')
            if (existingEl != null) existingEl.remove()

            let teamEl = document.createElement("div")
            teamEl.className = "row"
            teamEl.setAttribute("data-team", team)
            teamEl.setAttribute("data-id", this.id)

            let teamSettingsBlock = document.createElement("div")
            teamSettingsBlock.className = "table-settings-block"
            teamSettingsBlock.setAttribute("data-id", this.id)
            teamEl.appendChild(teamSettingsBlock)

            let tsChunk = document.createElement("div")
            tsChunk.className = "table-settings-chunk"
            let num = 0
            for (let i in Lists.lists) {
                num++
                if (num > Lists.lists.length / 2 + 0.5 && Lists.lists.length > 4) {
                    num = 0
                    teamSettingsBlock.appendChild(tsChunk)
                    tsChunk = document.createElement("div")
                    tsChunk.className = "table-settings-chunk"
                }
                let index = parseInt(i)
                let list = Lists.lists[index]

                let listEl = document.createElement("div")
                listEl.className = "table-setting material-symbols-outlined"
                listEl.style.color = ""
                listEl.innerText = list.icon
                listEl.title = list.name
                listEl.setAttribute("data-list", list.id)
                listEl.setAttribute("data-team", team)
                listEl.setAttribute("data-id", this.id)
                if (list.includes(team)) {
                    listEl.classList.add("filled")
                    listEl.style.color = list.color.color
                }
                listEl.addEventListener("click", () => {
                    list.toggle(team)
                })
                tsChunk.appendChild(listEl)
            }
            teamSettingsBlock.appendChild(tsChunk)

            for (let column of this.columns) {
                let data = document.createElement("div")
                data.className = "data"
                data.setAttribute("data-column", column.columnId)
                data.setAttribute("data-team", team)
                data.setAttribute("data-id", this.id)

                let value = typeof column.data[team] === "object" ? column.data[team]["summarized"] : column.data[team]
                if (typeof value === "number") data.innerText = (Math.round(value * rounding) / rounding) + ""
                else data.innerText = value
                teamEl.appendChild(data)
            }

            if (usingTBAMedia) {
                let logo = document.createElement("img")
                logo.setAttribute("data-team-logo", team)
                logo.setAttribute("data-id", this.id)
                if (typeof team_data[team] !== "undefined" && typeof team_data[team].Icon !== "undefined") logo.src = team_data[team].Icon
                else logo.src = MISSING_LOGO
                logo.className = "table-logo"
                teamEl.appendChild(logo)
            }

            let tools = document.createElement("div")
            tools.className = "tools"

            this.content.appendChild(teamEl)
        }
    }
    removeTeam(...[teams]) {
        if (typeof teams !== "object") teams = [teams]
        for (let team of teams) {
            document.querySelector(`.row[data-team="${team}"][data-id="${this.id}"]`).remove()
            this.teams.splice(this.teams.indexOf(team), 1)
        }
    }
    setTeams(...[teams]) {
        if (typeof teams !== "object") teams = [teams]
        this.removeTeam(this.teams.slice()) // Sliced to clone array because there was some funky stuff happening
        this.addTeam(teams)
    }
    setActiveColumn(id) {
        if (this.activeColumn === id) { // Change Sort
            this.sort *= -1
        } else { // Change Column
            if (this.activeColumn !== "") document.querySelector(`.header[data-column="${this.activeColumn}"][data-id="${this.id}"]`).classList.remove("selected")
            this.activeColumn = id
            let headerEl = document.querySelector(`.header[data-column="${id}"][data-id="${this.id}"]`)
            headerEl.classList.add("selected")
            this.sort = 1
        }

        this.sortRows()
    }
    refresh() {
        super.refresh()

        for (let col of this.columns) {
            let elements = document.querySelectorAll(`[data-column="${col.columnId}"][data-id="${this.id}"]`)
            for (let el of elements) {
                el.style.width = col.size + 'px'
                el.style.order = ((col.order * 2) + 100)
                document.querySelector(`[data-column-size="${col.columnId}"][data-id="${this.id}"]`).style.order = ((col.order * 2) + 101)
            }
        }
        for (let team of this.teams) {
            for (let list of Lists.lists) {
                let listEl = document.querySelector(`[data-list="${list.id}"][data-id="${this.id}"][data-team="${team}"]`)
                if (list.includes(team)) {
                    listEl.classList.add("filled")
                    listEl.style.color = list.color.color
                } else {
                    listEl.classList.remove("filled")
                    listEl.style.color = ""
                }
            }
        }

        // TODO do the below less
        for (let col of this.columns) this.setTextSizes(col)
    }
    sortRows() {
        if (this.teams.length === 0) return
        this.content.scrollTop
        let teams = [...this.teams]
        let data = this.getColumnById(this.activeColumn).data
        teams.sort((a, b) => {
            let valA = typeof data[a] === "object" ? data[a]["summarized"] : data[a]
            let valB = typeof data[b] === "object" ? data[b]["summarized"] : data[b]

            if (typeof valA === "string" || typeof valB === "string") return (""+valA).toLowerCase().trim() === (""+valB).toLowerCase().trim() ? 0 : (""+valA).toLowerCase().trim() > (""+valB).toLowerCase().trim() ? 1 : -1
            return valA - valB
        })
        if (this.sort === -1) teams.reverse()

        let hasAbove = false
        let hasBelow = false
        for (let team in teams) {
            let listSort = Lists.getListAffectingTeam(teams[team]).sort
            let sortOffset = (listSort == List.Sort.SORT_ABOVE ? -1000 : (listSort == List.Sort.SORT_BELOW ? 1000 : 0))
            let row = document.querySelector(`[data-team="${teams[team]}"][data-id="${this.id}"]`)
            row.style.order = (parseInt(team) + sortOffset)
            if (listSort === List.Sort.HIDE) row.classList.add("hidden")
            else row.classList.remove("hidden")

            if (listSort === List.Sort.SORT_ABOVE) hasAbove = true
            if (listSort === List.Sort.SORT_BELOW) hasBelow = true
        }

        if (hasAbove) this.aboveDivider.classList.remove("hidden")
        else this.aboveDivider.classList.add("hidden")
        if (hasBelow) this.belowDivider.classList.remove("hidden")
        else this.belowDivider.classList.add("hidden")
    }
    indexOfColumn(column) {
        if (typeof column === "string") column = this.getColumnById(column)
        return this.columns.indexOf(column)
    }
    setTextSizes(col) {
        let elements = document.querySelectorAll(`[data-column="${col.columnId}"][data-id="${this.id}"]`)

        for (let el of elements) {
            let fontSize = 1.06
            do {
                fontSize -= Math.max(el.scrollHeight - el.clientHeight, (el.scrollHeight - el.clientHeight) < 1 ? 0 : 20) / 200
                el.style.fontSize = fontSize + "rem"
                if (fontSize < 0.6) break;
            }
            while(el.scrollHeight > el.clientHeight)
        }
    }

    /**
     * Will refresh table values
     */
    hardRefresh() {
        super.hardRefresh();
        this.refresh()

        // Add icon to header, if it doesn't exist yet.
        if (this.hasAddedMedia === undefined && usingTBAMedia) {
            let logoPlaceholder = document.createElement("div")
            logoPlaceholder.className = "table-logo placeholder"
            this.header.appendChild(logoPlaceholder)
            this.hasAddedMedia = true
        }

        // Update logos
        for (let team of this.teams) {
            for (let logo of document.querySelectorAll(`[data-id="${this.id}"][data-team-logo="${team["team_number"]}"]`)) {
                if (typeof team_data[team] !== "undefined" && typeof team_data[team].Icon !== "undefined") logo.src = team_data[team].Icon
                else logo.src = MISSING_LOGO
            }
        }

        this.addTeamEl(this.teams)
        this.sortRows()

        // TODO add refresh for values
    }
}

class Graph extends Widget {
    constructor() {
        super();

        this.content.classList.add("no-scroll")

        this.column = getColumnFromID("match`Scoring`Coral Scored")
        this.teams = [4915, 2046, 2910, 2907]
        this.selectedTeam = null

        document.addEventListener("mouseup", () => {
            if (this.selectedTeam == null) return
            this.selectedTeam = null
            this.createExpressions(true)
        })

        this.name = "Graph - " + this.column.name

        this.calcEl = document.createElement("div")
        this.calcEl.className = "graph"
        this.content.appendChild(this.calcEl)

        this.teamsEl = document.createElement("div")
        this.teamsEl.className = "graph-teams"
        this.content.appendChild(this.teamsEl)

        if (desmosReady) {
            this.createCalculator()
        } else {
            onDesmosLoad.push(this.createCalculator)
        }

        this.createTeamList()

        this.minWidth = 200
        this.minHeight = 200
    }

    refresh() {
        super.refresh();
        if (this.content.offsetHeight < 500 || this.content.offsetWidth < 550 || (this.teamsEl.offsetHeight / this.content.offsetHeight > 0.25)) this.content.classList.add("small")
        else this.content.classList.remove("small")
        this.calcEl.style.width = this.content.offsetWidth - 2 + "px"
        this.calcEl.style.height = this.content.offsetHeight - this.teamsEl.offsetHeight + "px"
    }

    createCalculator() {
        this.calculator = Desmos.GraphingCalculator(this.calcEl, {
            graphpaper: true,
            expressions: false,
            settingsMenu: false,
            zoomButtons: true,
            keypad: false,
            keypadActivated: false,
            lockViewport: false,
            fontSize: 16,
            //projectorMode: true
        })
        this.createExpressions()
    }

    createExpressions(maintainBounds = false, clearExpressions = true) {
        if (clearExpressions) {
            this.calculator.getExpressions().forEach((expression) => {
                this.calculator.removeExpression(expression)
            })
        }
        this.calculator.updateSettings({xAxisLabel: graphSettings.x === "absolute" ? "Event Match #" : "Team Match #", yAxisLabel: this.column.name})

        let minX = Infinity
        let maxX = -Infinity
        let minY = Infinity
        let maxY = -Infinity
        for (let i in this.teams) {
            let team = this.teams[i]
            let matches = []
            let values = []

            for (let m in this.column.data[team]) {
                if (!isNaN(parseFloat(m))) {
                    if (graphSettings.x === "relative") {
                        if (usingTBAMatches) {
                            if (!Object.keys(team_data[team].TBA.matches).includes(m)) continue
                            else {
                                let relativeNumber = Object.keys(team_data[team].TBA.matches).indexOf(m) + 1
                                matches.push(relativeNumber)
                                minX = Math.min(minX, relativeNumber)
                                maxX = Math.max(maxX, relativeNumber)
                            }
                        } else {
                            matches.push(m)
                            minX = Math.min(minX, m)
                            maxX = Math.max(maxX, m)
                        }
                    } else {
                        matches.push(m)
                        minX = Math.min(minX, m)
                        maxX = Math.max(maxX, m)
                    }
                    minY = Math.min(minY, this.column.data[team][m])
                    maxY = Math.max(maxY, this.column.data[team][m])
                    values.push(this.column.data[team][m])
                }
            }

            this.calculator.setExpression({ id: "x" + team, latex: 'x_' + i + ' = \\left['+matches+'\\right]' });
            this.calculator.setExpression({ id: "y" + team,  latex: 'y_' + i + ' = \\left['+values+'\\right]' });
            if (graphSettings.points)
                this.calculator.setExpression({
                    id: "points" + team,
                    latex: '(x_{' + i + '},y_{' + i + '})',
                    color: this.getTeamColor(i),
                    pointStyle: this.getTeamShape(i),
                    pointSize: (this.selectedTeam === null ? 16 : (this.selectedTeam === team ? 18 : 16)),
                    pointOpacity: (this.selectedTeam === null ? 0.8 : (this.selectedTeam === team ? 1 : 0.25)),
                    label: team + " (${x_" + i + "}, ${y_" + i + "})"
                });
            if (graphSettings.bestfit)
                this.calculator.setExpression({
                    id: "line" + team,
                    latex: 'y_{' + i + '}\\sim a_{' + i + '}x_{' + i + '}+b_{' + i + '}',
                    color: this.getTeamColor(i),
                    lineWidth: (this.selectedTeam === null ? 4 : (this.selectedTeam === team ? 5 : 4)),
                    lineOpacity: (this.selectedTeam === null ? 0.8 : (this.selectedTeam === team ? 1 : 0.25))
                })
        }

        if (!maintainBounds) {
            this.calculator.setMathBounds({
                left: minX - (maxX - minX) * 0.05,
                right: maxX + (maxX - minX) * 0.05,
                bottom: minY - (maxY - minY) * 0.05,
                top: maxY + (maxY - minY) * 0.05
            })
            this.calculator.setDefaultState(this.calculator.getState())
        }
    }

    createTeamList() {
        this.teamsEl.innerHTML = ""
        for (let i in this.teams) {
            let t = this.teams[i]
            let teamEl = document.createElement("div")
            teamEl.className = "graph-team"

            if (usingTBAMedia) {
                let logo = document.createElement("img")
                logo.setAttribute("data-team-logo", t)
                logo.setAttribute("data-id", this.id)
                if (typeof team_data[t] !== "undefined" && typeof team_data[t].Icon !== "undefined") logo.src = team_data[t].Icon
                else logo.src = MISSING_LOGO
                logo.className = "graph-logo"
                teamEl.appendChild(logo)
            }

            let teamName = document.createElement("div")
            teamName.className = "graph-team-name"
            teamName.style.color = this.getTeamColor(i)
            teamName.innerText = this.getShapeSymbol(this.getTeamShape(i)) + " " + (usingTBA ? t + " " + team_data[t]["Name"] : t)
            teamEl.appendChild(teamName)

            teamEl.addEventListener("mousedown", (e) => {
                e.preventDefault()
                this.selectedTeam = t
                this.createExpressions(true, false)
            })

            this.teamsEl.appendChild(teamEl)
        }
    }

    getTeamColor(i) {
        let ctx = new OffscreenCanvas(1,1).getContext("2d")
        ctx.fillStyle = "oklch(56% 46% "+((360 / this.teams.length) * (i))+")"
        ctx.fillRect(0,0,1,1)
        return "rgba(" + ctx.getImageData(0,0,1,1).data.join(", ") + ")"
    }

    getTeamShape(i) {
        let shapes = ["POINT", "CROSS", "SQUARE", "PLUS", "TRIANGLE", "DIAMOND", "STAR"]
        return shapes[i % shapes.length]
    }

    getShapeSymbol(i) {
        switch (i) {
            case "POINT": return '⬤'
            case "CROSS": return '✖'
            case "SQUARE": return '■'
            case "PLUS": return '🞦'
            case "TRIANGLE": return '▲'
            case "DIAMOND": return '◆'
            case "STAR": return '★'
        }
    }

    hardRefresh() {
        super.hardRefresh();
        this.createExpressions()
        this.createTeamList()
    }
}

class TeamInfo extends Widget {
    constructor() {
        super();

        this.minWidth = 170
        this.minHeight = 100
    }
    setTeams(teams) {
        if (typeof teams !== "object") teams = [teams]
        this.content.innerHTML = ""

        this.name = ""

        for (let team of teams) {
            let imageAndBasicHolderHolder = document.createElement("div")
            imageAndBasicHolderHolder.className = "team-info-flex-horizontal"
            this.content.appendChild(imageAndBasicHolderHolder)

            let logo = document.createElement("img")
            logo.setAttribute("data-team-logo", team)
            logo.setAttribute("data-id", this.id)
            logo.className = "team-info-logo"
            imageAndBasicHolderHolder.appendChild(logo)

            let basicInfoHolder = document.createElement("div")
            basicInfoHolder.className = "team-info-basic-holder"
            imageAndBasicHolderHolder.appendChild(basicInfoHolder)

            let nameEl = document.createElement("div")
            nameEl.className = "team-info-name"
            basicInfoHolder.appendChild(nameEl)

            let location = document.createElement("div")
            location.className = "team-info-basic-text"
            basicInfoHolder.appendChild(location)

            let rookieYear = document.createElement("div")
            rookieYear.className = "team-info-basic-text"
            basicInfoHolder.appendChild(rookieYear)

            let eventRank = document.createElement("div")
            eventRank.className = "team-info-basic-text"
            basicInfoHolder.appendChild(eventRank)

            if (usingTBA) {
                if (teams.length > 1) this.name = this.name + ", " + team
                else this.name = this.name + ", " + team + " " + team_data[team].Name

                nameEl.innerText = team + " " + team_data[team].Name
                location.innerText = team_data[team].TBA["school_name"]
                location.title = team_data[team].TBA["city"] + ", " + team_data[team].TBA["state_prov"] + " (" + team_data[team].TBA["country"] + ")"
                rookieYear.innerText = "Rookie Year: " + team_data[team].TBA["rookie_year"]

                if (usingTBAMedia) {
                    if (typeof team_data[team] !== "undefined" && typeof team_data[team].Icon !== "undefined") logo.src = team_data[team].Icon
                    else logo.src = MISSING_LOGO
                }
                if (usingTBARank) {
                    eventRank.innerText = "Rank " + processedData.orpheus.data["ranking"][team] + " of " + Object.keys(team_data).length
                }
            } else {
                this.name = this.name + ", " + team
                logo.remove()
            }
        }

        this.name = this.name.substring(2)
    }
}

class TeamMedia extends Widget {
    constructor() {
        super()
        this.minWidth = 200
        this.minHeight = 70

        this.content.classList.add("no-scroll")
        this.content.classList.add("team-media-widget")

        this.activeMedia = null
        this.activeMediaType = ""

        this.controls = document.createElement("div")
        this.controls.className = "team-media-controls"
        this.content.appendChild(this.controls)

        this.previous = document.createElement("button")
        this.previous.className = "material-symbols-outlined"
        this.previous.innerText = "arrow_left"
        this.previous.addEventListener("click", () => {
            this.mediaOn--
            if (this.mediaOn < 0) this.mediaOn = team_data[this.team].media.length + this.mediaOn
            this.setMedia(this)
        })
        this.controls.appendChild(this.previous)

        this.progress = document.createElement("div")
        this.controls.appendChild(this.progress)

        this.next = document.createElement("button")
        this.next.className = "material-symbols-outlined"
        this.next.innerText = "arrow_right"
        this.next.addEventListener("click", () => {
            this.mediaOn++
            if (this.mediaOn >= team_data[this.team].media.length) this.mediaOn = 0
            this.setMedia()
        })
        this.controls.appendChild(this.next)

        this.content.addEventListener("mouseenter", () => {
            if (team_data[this.team].media.length > 0) this.controls.classList.add("shown")
        })
        this.content.addEventListener("mouseleave", () => {
            this.controls.classList.remove("shown")
        })

        this.mediaOn = 0
        this.team = null
    }
    setTeam(team) {
        this.activeMedia = null
        this.activeMediaType = ""

        if (usingTBA) {
            this.name = team + " " + team_data[team].Name + " Media"
        } else {
            this.name = this.name + ", " + team
        }

        this.previous.disabled = team_data[team]["media"].length === 0
        this.next.disabled = team_data[team]["media"].length === 0

        this.mediaOn = 0
        this.team = team

        this.setMedia()

        this.refresh()
    }
    refresh() {
        super.refresh()
        this.controls.style.left = (this.content.getBoundingClientRect().left + this.content.offsetWidth / 2 - this.controls.offsetWidth / 2) + "px"
        this.controls.style.top = (this.content.getBoundingClientRect().bottom - this.controls.offsetHeight) + "px"

        if (this.activeMedia === null) return
        if (this.activeMediaType === "image") {
            this.activeMedia.style.width = (this.content.offsetWidth) + "px"
            this.activeMedia.style.height = (this.content.offsetHeight) + "px"
        }
    }
    hardRefresh() {
        super.hardRefresh();
        setTimeout(() => {
            this.refresh()
        }, 0)
    }
    setMedia() {
        if (this.activeMedia !== null) this.activeMedia.remove()
        if (team_data[this.team].media.length === 0) {
            let info = document.createElement("div")
            info.innerText = "Team " + this.team + " does not have any media"
            this.activeMedia = info
            this.activeMediaType = "text"
            this.content.appendChild(info)
        } else {
            this.progress.innerText = (this.mediaOn + 1) + " / " + team_data[this.team].media.length
            let media = team_data[this.team].media[this.mediaOn]
            if (media.type === "image") {
                let image = document.createElement("img")
                image.src = media.src
                this.activeMedia = image
                this.activeMediaType = "image"
                this.content.appendChild(image)
            }
        }
    }
}

/**
 * Widget to display a list of teams
 */
class ListWidget extends Widget {
    constructor() {
        super();
    }
    refresh() {
        super.refresh();
    }

    hardRefresh() {
        super.hardRefresh();
    }
}
