'use strict';

/*
This file contains all the widgets that the user interacts with and displays data.
 */

class Table extends Widget {
    constructor() {
        super();
        this.name = "Table"
        this.type = "table"

        this.elements = {}
        this.teamElements = {}
        this.columnResizers = {}

        this.activeColumn = ""
        this.columns = []
        this.teams = Object.keys(team_data).map((a) => parseInt(a))
        for (let team of this.teams) this.addTeamEl(team)
        this.sort = 1

        /**
         * Are all teams shown or just those with a list enabled in the table's scope?
         */
        this.showAll = true
        this.scope = {}
        this.scopePanel = document.createElement("dialog")
        this.scopePanel.className = "table-scope-holder"
        this.content.appendChild(this.scopePanel)

        Events.on(Events.LIST_CHANGE, this.sortRows, this)

        this.content.classList.add("table")

        this.header = document.createElement("div")
        this.header.classList.add("row", "header")
        this.content.appendChild(this.header)

        let teamSettingsBlock = document.createElement("div")
        teamSettingsBlock.className = "table-settings-block"
        teamSettingsBlock.setAttribute("data-id", this.id)
        this.header.appendChild(teamSettingsBlock)

        this.addHeaderIcon("visibility", "Scope", this.scopePanel, this.openScopeEditor)
        this.addHeaderIcon("view_column", "Columns", this.scopePanel, this.openColumnEditor, [0, 60])

        this.columnDragIndicator = document.createElement("div")
        this.columnDragIndicator.className = "data-drag-indicator"
        this.columnDragIndicator.style.order = "-99"
        this.header.appendChild(this.columnDragIndicator)

        if (usingTBAMedia) {
            let logoPlaceholder = document.createElement("div")
            logoPlaceholder.className = "table-logo placeholder"
            this.header.appendChild(logoPlaceholder)
            this.hasAddedMedia = true
        }

        this.aboveDivider = document.createElement("div")
        this.aboveDivider.className = "divider-above hidden"
        this.content.appendChild(this.aboveDivider)

        this.belowDivider = document.createElement("div")
        this.belowDivider.className = "divider-below hidden"
        this.content.appendChild(this.belowDivider)

        this.minWidth = 220
        this.minHeight = 165
    }
    addColumn(...[columns]) {
        if (typeof columns !== "object" || typeof columns[0] == "undefined") columns = [columns]
        for (let id of columns) {
            let column
            if (typeof id === "object") {
                column = id
            } else column = getColumnFromID(id)

            this.columns.push({
                columnId: column.id ?? column.columnId,
                name: column.table,
                table: column.table,
                mapping: column.mapping,
                size: column["size"] ?? 110, // Pixels
                data: column.data,
                order: column["order"] ?? this.columns.length, // Left to right
            })
            let thisColumn = this.columns[this.columns.length - 1]

            column.id = column.id ?? column.columnId

            this.elements[thisColumn.columnId] = {}

            for (let team of this.teams) {
                this.teamElements[team].appendChild(this.createTableCell(team, column))
            }

            let headerEl = document.createElement("div")
            headerEl.className = "data header"
            headerEl.setAttribute("data-column", column.id)
            this.elements[thisColumn.columnId]["header"] = headerEl
            headerEl.innerText = column.name
            headerEl.addEventListener("click", () => {
                this.setActiveColumn(column.id)
            })
            this.header.appendChild(headerEl)

            let controls = document.createElement("div")
            controls.className = "data-controls"
            headerEl.appendChild(controls)

            //#region Resizing
            let colResizer = document.createElement("div")
            colResizer.className = "data-resizer"
            this.columnResizers[column.id] = colResizer
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

            let removeButton = document.createElement("div")
            removeButton.innerText = "cancel_presentation"
            removeButton.addEventListener("click", (e) => {
                e.stopPropagation()
                this.removeColumn(thisColumn.columnId)
            })
            removeButton.className = "column-header-button material-symbols-outlined"

            controls.appendChild(colDragger)
            controls.appendChild(removeButton)
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

            this.elements[column.columnId]["header"].remove()
            this.columnResizers[column.columnId].remove()
            delete this.elements[column.columnId]["header"]
            delete this.columnResizers[column.columnId]

            if (this.activeColumn === column.columnId) {
                this.activeColumn = "" // Stops the setActiveFunction function from trying to change the element
                this.setActiveColumn(this.columns[0].columnId)
            }
            this.hardRefresh()
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
            if (typeof this.teamElements[team] !== "undefined" && this.teamElements[team] != null) {
                this.teamElements[team].remove()
                delete this.teamElements[team]
            }

            let teamEl = document.createElement("div")
            teamEl.className = "row"
            this.teamElements[team] = teamEl

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
                teamEl.appendChild(this.createTableCell(team, column))
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
            this.teamElements[team].remove()
            delete this.teamElements[team]
            this.teams.splice(this.teams.indexOf(team), 1)
        }
    }
    setTeams(...[teams]) {
        if (typeof teams !== "object") teams = [teams]
        this.removeTeam(this.teams.slice()) // Sliced to clone array because there was some funky stuff happening
        this.addTeam(teams)
    }
    setActiveColumn(id, specificSort = null) {
        if (this.activeColumn === id) { // Change Sort
            this.sort *= -1
        } else { // Change Column
            if (this.activeColumn !== "") this.elements[this.activeColumn]["header"].classList.remove("selected")
            this.activeColumn = id
            this.elements[this.activeColumn]["header"].classList.add("selected")
            this.sort = -1
        }
        if (specificSort !== null) this.sort = specificSort

        this.sortRows()
    }
    refresh() {
        super.refresh()

        for (let col of this.columns) {
            for (let el of Object.values(this.elements[col.columnId])) {
                el.style.width = col.size + 'px'
                el.style.order = ((col.order * 2) + 100)

                this.columnResizers[col.columnId].style.order = ((col.order * 2) + 101)
            }
        }
        for (let team of this.teams) {
            for (let list of Lists.lists) {
                let listEl = document.querySelector(`[data-list="${list.id}"][data-id="${this.id}"][data-team="${team}"]`)
                if (listEl == null) continue
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
        if (this.teams.length === 0 || this.activeColumn === "" || this.parent === null) return
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
            let listSort = Lists.getSortAffectingTeam(teams[team], this.scope, this.showAll)
            let sortOffset = (listSort == List.Sort.SORT_ABOVE ? -1000 : (listSort == List.Sort.SORT_BELOW ? 1000 : 0))
            let row = this.teamElements[teams[team]]
            if (row === null) break

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
    includes(column) {
        if (typeof column === "string") column = this.getColumnById(column)
        return this.columns.includes(column)
    }
    setTextSizes(col) {
        for (let el of Object.values(this.elements[col.columnId])) {
            let fontSize = 1.06
            do {
                fontSize -= Math.max(el.scrollHeight - el.clientHeight, (el.scrollHeight - el.clientHeight) < 1 ? 0 : 20) / 200
                el.style.fontSize = fontSize + "rem"
                if (fontSize < 0.6) break;
            }
            while(el.scrollHeight > el.clientHeight)
        }
    }
    createTableCell(team, column) {
        let dataEl = document.createElement("div")
        dataEl.className = "data"
        this.elements[column.id ?? column.columnId][team] = dataEl

        if (column.mapping.type === "ratio" && (typeof column.mapping["summarize"] === "undefined" || column.mapping["summarize"] === "ratio")) {
            dataEl.innerHTML = ""

            let num = document.createElement("div")
            num.className = "numerator"
            num.innerText = (Math.round(column.data[team]["sum_num"] * rounding) / rounding) + ""
            dataEl.appendChild(num)

            let divider = document.createElement("div")
            divider.className = "ratio-divider"
            dataEl.appendChild(divider)

            let den = document.createElement("div")
            den.className = "numerator"
            den.innerText = (Math.round(column.data[team]["sum_den"] * rounding) / rounding) + ""

            dataEl.title = (Math.round(column.data[team]["summarized"] * rounding) / rounding)
            dataEl.appendChild(den)
        } else {
            let value = typeof column.data[team] === "object" ? column.data[team]["summarized"] : column.data[team]
            if (typeof value === "number") dataEl.innerText = (Math.round(value * rounding) / rounding) + ""
            else dataEl.innerText = value
        }

        return dataEl
    }

    openScopeEditor() {
        this.scopePanel.innerHTML = ""

        let panel = document.createElement("div")
        panel.className = "table-list-scope-edit"
        this.scopePanel.appendChild(panel)

        for (let list of Lists.lists) {
            let el = document.createElement("div")
            el.className = "list"

            let checkbox = document.createElement("input")
            checkbox.type = "checkbox"
            checkbox.checked = (typeof this.scope[list.id] !== "undefined")
            checkbox.addEventListener("change", () => {
                dropdown.disabled = !checkbox.checked
                if (checkbox.checked) {
                    this.scope[list.id] = List.Sort.LIST_DEFAULT
                    dropdown.value = List.Sort.LIST_DEFAULT
                }
                else {
                    delete this.scope[list.id]
                    dropdown.value = "aaa"
                }
                this.sortRows()
            })
            el.appendChild(checkbox)

            let icon = document.createElement("div")
            icon.className = "material-symbols-outlined filled list-icon"
            icon.innerText = list.icon
            icon.style.color = list.color.color
            el.appendChild(icon)

            let name = document.createElement("div")
            name.innerText = list.name
            el.appendChild(name)

            let dropdown = document.createElement("select")
            let options = {
                "Sort Above": List.Sort.SORT_ABOVE,
                "Sort Below": List.Sort.SORT_BELOW,
                "Hide": List.Sort.HIDE,
            }
            options["List Default (" + Object.fromEntries(Object.entries(options).map(a => a.reverse()))[list.sort] + ")"] = List.Sort.LIST_DEFAULT
            for (let option of Object.keys(options)) {
                let optionEl = document.createElement("option")
                optionEl.innerText = option
                optionEl.setAttribute("value", options[option])
                dropdown.appendChild(optionEl)
            }
            if (typeof this.scope[list.id] === "undefined") {
                dropdown.value = "aaa"
                dropdown.disabled = true
            }
            else {
                dropdown.value = list.sort
            }
            dropdown.addEventListener("change", () => {
                this.scope[list.id] = parseInt(dropdown.value)
                this.sortRows()
            })
            el.appendChild(dropdown)

            panel.appendChild(el)
        }

        let showAllHolder = document.createElement("div")
        showAllHolder.style.display = "flex"
        showAllHolder.style["flex-direction"] = "row"
        panel.appendChild(showAllHolder)

        let showAllCheckbox = document.createElement("input")
        showAllCheckbox.type = "checkbox"
        showAllCheckbox.checked = this.showAll
        showAllCheckbox.id = "table-label-checkbox"
        showAllCheckbox.addEventListener("change", () => {
            this.showAll = showAllCheckbox.checked
            this.sortRows()
        })
        showAllHolder.appendChild(showAllCheckbox)

        let showAllLabel = document.createElement("label")
        showAllLabel.innerText = "Show unlisted teams"
        showAllLabel.for = "table-label-checkbox"
        showAllHolder.appendChild(showAllLabel)
    }
    openColumnEditor() {
        this.scopePanel.innerHTML = ""

        let panel = document.createElement("div")
        panel.className = "table-column-edit"
        this.scopePanel.appendChild(panel)

        let label = document.createElement("div")
        label.className = "add-columns-title"
        label.innerText = "Add Columns"
        panel.appendChild(label)

        let columns = document.createElement("div")
        columns.className = "add-columns"
        panel.appendChild(columns)

        function findColumns(context, schema, nameOverride) {
            let group = document.createElement("div")
            group.classList = "table-column-panel-group"

            let open = false

            let groupController = document.createElement("div")
            groupController.className = "table-column-panel-group-controller"
            let dropdownButton = document.createElement("div")
            dropdownButton.className = "material-symbols-outlined"
            dropdownButton.innerText = "arrow_drop_down"
            groupController.appendChild(dropdownButton)
            let groupName = document.createElement("div")
            groupName.innerText = nameOverride ?? getColumnFromID(context).name
            groupController.appendChild(groupName)
            groupController.addEventListener("click", (e) => {
                open = !open
                dropdownButton.innerText = open ? "arrow_drop_up" : "arrow_drop_down"
                groupColumns.classList.toggle("hidden")
                e.preventDefault()
                window.getSelection().removeAllRanges()
            })
            group.appendChild(groupController)

            let groupColumns = document.createElement("div")
            groupColumns.className = "table-column-panel-columns-holder hidden"
            group.appendChild(groupColumns)

            let childHolder = document.createElement("div")
            childHolder.className = "child-holder"
            groupColumns.appendChild(childHolder)

            let grandchildHolder = document.createElement("div")
            grandchildHolder.className = "grandchild-holder"
            groupColumns.appendChild(grandchildHolder)

            for (let child of Object.keys(schema)) {
                let id = context + "`" + child
                if (typeof schema[child]["type"] === "undefined") {
                    let cEl = findColumns.call(this,id, schema[child], undefined)
                    if (cEl.children[1].children.length) grandchildHolder.appendChild(cEl)
                }
                else if (schema[child]["table"] && !this.includes(id)) {
                    let el = document.createElement("div")
                    el.className = "table-column-panel-column"
                    el.innerText = getColumnFromID(id).table
                    el.value = id

                    el.addEventListener("click", () => {
                        this.addColumn(id)
                        setTimeout(() => {
                            el.remove()
                            let g = group
                            while (g.children[1].children.length === 0) {
                                let p = g.parentElement.parentElement
                                g.remove()
                                g = p
                            }
                        }, 1)
                    })

                    childHolder.appendChild(el)
                }
            }
            return group
        }
        if (typeof mapping !== "undefined") {
            for (let schema of Object.keys(mapping)) {
                let el = findColumns.call(this, schema, mapping[schema].data, mapping[schema]["alias"] ?? schema)
                if (el.children[1].children.length) columns.appendChild(el)
            }
        }
        let el = findColumns.call(this, "orpheus", internalMapping, "Orpheus")
        if (el.children[1].children.length) columns.appendChild(el)
        //findColumns(schema, mapping[schema].data, mapping[schema]["alias"] ?? schema)
    }

    /**
     * Will refresh table values
     */
    hardRefresh() {
        super.hardRefresh();

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
        
        this.refresh()
    }

    out() {
        return super.out({
            activeColumn: this.activeColumn,
            showAll: this.showAll,
            scope: this.scope,
            columns: this.columns,
            teams: this.teams,
            sort: this.sort,
        })
    }
    in(a) {
        console.log(JSON.parse(JSON.stringify(a)))
        let teams = a["teams"]
        for (let team of teams) {
            this.addTeam(team)
        }
        for (let team of a["columns"]) {
            this.addColumn(team)
        }
        delete a["teams"]
        delete a["columns"]
        let active = a["activeColumn"]
        delete a["activeColumn"]
        super.in(a)
        this.setActiveColumn(active, a["sort"])
    }
}

class Graph extends Widget {
    constructor() {
        super();

        this.type = "graph"
        this.minWidth = 200
        this.minHeight = 200

        this.content.classList.add("no-scroll")

        this.column = getColumnFromID("match`Scoring`Coral Scored")
        this.teams = []
        this.list = null
        this.selectedTeam = null

        this.scopePanel = document.createElement("dialog")
        this.scopePanel.className = "table-scope-holder"
        this.content.appendChild(this.scopePanel)
        this.addHeaderIcon("visibility", "Scope", this.scopePanel, this.openScopeEditor)

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

        Events.on(Events.LIST_CHANGE, () => {
            if (this.list !== null) {
                this.list = Lists.getFromId(this.list.id)
                this.teams = JSON.parse(JSON.stringify(this.list.teams))
                this.redoWidget()
            }
        }, this)
        Events.on(Events.GRAPH_SETTINGS, this.hardRefresh, this)

        let graphDropdown = document.createElement("select")
        graphDropdown.className = ""
        this._header.name.insertAdjacentElement("beforebegin", graphDropdown)

        function findGraphs(context, schema, nameOverride) {
            let group = document.createElement("optgroup")
            group.label = nameOverride ?? getColumnFromID(context).name
            for (let child of Object.keys(schema)) {
                if (typeof schema[child]["type"] === "undefined") {
                    findGraphs(context + "`" + child, schema[child], undefined)
                }
                else if (schema[child]["graph"]) {
                    let el = document.createElement("option")
                    let id = context + "`" + child
                    el.innerText = getColumnFromID(id).graph
                    el.value = id
                    group.appendChild(el)
                }
            }
            graphDropdown.appendChild(group)
        }
        for (let schema of Object.keys(mapping)) {
            findGraphs(schema, mapping[schema].data, mapping[schema]["alias"] ?? schema)
        }
        graphDropdown.addEventListener("change", () => {
            this.column = getColumnFromID(graphDropdown.value)
            this.name = "Graph - " + this.column.graph
            this.redoWidget()
        })
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
        if (this.teams.length === 0) this.teamsEl.innerText = "No teams selected"
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
    redoWidget() {
        this.createTeamList()
        this.createExpressions()
        this.refresh()
    }
    openScopeEditor() {
        this.scopePanel.innerHTML = ""

        let panel = document.createElement("div")
        panel.className = "graph-list-scope-edit"
        this.scopePanel.appendChild(panel)

        let listsLabel = document.createElement("div")
        listsLabel.innerText = "List"
        panel.appendChild(listsLabel)

        let lists = document.createElement("div")
        lists.className = "graph-list-of"
        panel.appendChild(lists)

        let activeList = null
        for (let list of Lists.lists) {
            let el = document.createElement("div")
            el.className = "list"

            let icon = document.createElement("div")
            icon.className = "material-symbols-outlined filled list-icon"
            icon.innerText = list.icon
            icon.style.color = list.color.color
            el.appendChild(icon)

            let name = document.createElement("div")
            name.innerText = list.name
            el.appendChild(name)

            el.addEventListener("click", () => {
                this.list = list
                if (activeList !== null) {
                    activeList.classList.remove("selected")
                }
                activeList = el
                activeList.classList.add("selected")
                this.teams = JSON.parse(JSON.stringify(list.teams))
                teams.innerHTML = ""
                for (let team of this.teams) {
                    addTeamEl(team)
                }
                this.redoWidget()
            })

            if (Lists.equal(list, this.list)) {
                el.classList.add("selected")
                activeList = el
            }

            lists.appendChild(el)
        }

        let teamsLabel = document.createElement("div")
        teamsLabel.innerText = "Team List"
        panel.appendChild(teamsLabel)

        let teams = document.createElement("div")
        teams.className = "graph-list-of"
        panel.appendChild(teams)

        let context = this
        function addTeamEl(team) {
            let teamEl = document.createElement("div")
            teamEl.className = "graph-scope-team"
            teamEl.innerText = team
            teamEl.addEventListener("click", () => {
                context.teams.splice(context.teams.indexOf(team), 1)
                context.redoWidget()
                context.list = null
                if (activeList !== null) {
                    activeList.classList.remove("selected")
                    activeList = null
                }
                setTimeout(() => teamEl.remove(), 1)
            })
            teams.appendChild(teamEl)
        }

        for (let team of this.teams) {
            addTeamEl(team)
        }

        let addButton = document.createElement("button")
        addButton.innerText = "Add team"
        addButton.addEventListener("click", () => {
            // TODO better search
            let x = prompt("What team number?")
            if (typeof team_data[x] !== "undefined") {
                this.teams.push(x)
                addTeamEl(x)
                this.redoWidget()
                this.list = null
                if (activeList !== null) {
                    activeList.classList.remove("selected")
                    activeList = null
                }
            }
        })
        panel.appendChild(addButton)
    }

    out() {
        return super.out({
            teams: this.teams,
            list: this.list,
            column: this.column,
        })
    }
}

class TeamInfo extends Widget {
    constructor() {
        super();

        this.type = "info"
        this.minWidth = 170
        this.minHeight = 100

        this.list = List.ALL
        this.teams = Object.keys(team_data)

        this.content.classList.add("team-info-widget")

        this.scopePanel = document.createElement("dialog")
        this.scopePanel.className = "table-scope-holder"
        this._header.holder.appendChild(this.scopePanel)
        this.addHeaderIcon("visibility", "Scope", this.scopePanel, this.openScopeEditor)
        Events.on(Events.LIST_CHANGE, () => this.onListChange(), this)
    }
    redoList() {
        this.content.innerHTML = ""

        if (this.teams.length > 0) {
            let name = ""
            for (let team of this.teams) {
                let imageAndBasicHolderHolder = document.createElement("div")
                imageAndBasicHolderHolder.className = "team-info-flex-horizontal"
                this.content.appendChild(imageAndBasicHolderHolder)

                let logo = document.createElement("img")
                logo.setAttribute("data-team-logo", team)
                logo.setAttribute("data-id", this.id)
                logo.className = "team-info-logo"
                imageAndBasicHolderHolder.appendChild(logo)

                let listChunk = document.createElement("div")
                listChunk.className = "team-info-list"
                for (let list of Lists.lists) {
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
                    listChunk.appendChild(listEl)
                }
                imageAndBasicHolderHolder.appendChild(listChunk)

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
                    if (this.teams.length > 1) name = name + ", " + team
                    else name = name + ", " + team + " " + team_data[team].Name

                    nameEl.innerText = team + " " + team_data[team].Name
                    location.innerText = team_data[team].TBA["school_name"]
                    location.title = team_data[team].TBA["city"] + ", " + team_data[team].TBA["state_prov"] + " (" + team_data[team].TBA["country"] + ")"
                    rookieYear.innerText = "Rookie Year: " + team_data[team].TBA["rookie_year"]

                    if (usingTBAMedia) {
                        if (typeof team_data[team] !== "undefined" && typeof team_data[team].Icon !== "undefined") logo.src = team_data[team].Icon
                        else logo.src = MISSING_LOGO
                    }
                    if (usingTBAMatches) {
                        eventRank.innerText = "Rank " + processedData.orpheus.data["ranking"][team] + " of " + Object.keys(team_data).length
                    }
                } else {
                    name = name + ", " + team
                    logo.remove()
                }
            }
            this.name = name.substring(2)
        } else {
            this.content.innerText = "Select teams or a list of teams to view info about them"
            this.name = "Team Info"
        }
    }
    openScopeEditor() {
        this.scopePanel.innerHTML = ""

        let panel = document.createElement("div")
        panel.className = "graph-list-scope-edit"
        this.scopePanel.appendChild(panel)

        let listsLabel = document.createElement("div")
        listsLabel.innerText = "List"
        panel.appendChild(listsLabel)

        let lists = document.createElement("div")
        lists.className = "graph-list-of"
        panel.appendChild(lists)

        let activeList = null
        for (let list of [List.ALL, ...Lists.lists]) {
            let el = document.createElement("div")
            el.className = "list"

            let icon = document.createElement("div")
            icon.className = "material-symbols-outlined filled list-icon"
            icon.innerText = list.icon
            icon.style.color = list.color.color
            el.appendChild(icon)

            let name = document.createElement("div")
            name.innerText = list.name
            el.appendChild(name)

            el.addEventListener("click", () => {
                this.list = list
                if (activeList !== null) {
                    activeList.classList.remove("selected")
                }
                activeList = el
                activeList.classList.add("selected")
                this.teams = JSON.parse(JSON.stringify(list.teams))
                if (list == List.ALL) this.teams = Object.keys(team_data)
                teams.innerHTML = ""
                for (let team of this.teams) {
                    addTeamEl(team)
                }
                this.redoList()
            })

            if (Lists.equal(list, this.list)) {
                el.classList.add("selected")
                activeList = el
            }

            lists.appendChild(el)
        }

        let teamsLabel = document.createElement("div")
        teamsLabel.innerText = "Team List"
        panel.appendChild(teamsLabel)

        let teams = document.createElement("div")
        teams.className = "graph-list-of"
        panel.appendChild(teams)

        let context = this
        function addTeamEl(team) {
            let teamEl = document.createElement("div")
            teamEl.className = "graph-scope-team"
            teamEl.innerText = team
            teamEl.addEventListener("click", () => {
                context.teams.splice(context.teams.indexOf(team), 1)
                context.redoList()
                context.list = null
                if (activeList !== null) {
                    activeList.classList.remove("selected")
                    activeList = null
                }
                setTimeout(() => teamEl.remove(), 1)
            })
            teams.appendChild(teamEl)
        }

        for (let team of this.teams) {
            addTeamEl(team)
        }

        let addButton = document.createElement("button")
        addButton.innerText = "Add team"
        addButton.addEventListener("click", () => {
            // TODO better search
            let x = prompt("What team number?")
            if (typeof team_data[x] !== "undefined") {
                this.teams.push(x)
                addTeamEl(x)
                this.redoWidget()
                this.list = null
                if (activeList !== null) {
                    activeList.classList.remove("selected")
                    activeList = null
                }
            }
        })
        panel.appendChild(addButton)
    }
    onListChange() {
        if (this.list !== null) {
            this.list = Lists.getFromId(this.list.id)
            this.teams = JSON.parse(JSON.stringify(this.list.teams))
            if (Lists.equal(this.list, List.ALL)) this.teams = Object.keys(team_data)
            this.redoList()
        }
    }

    out() {
        return super.out({
            list: this.list,
            teams: this.teams,
        })
    }
    in(a) {
        super.in(a)
        this.onListChange()
        this.redoList()
    }
}

class TeamMedia extends Widget {
    constructor() {
        super()

        this.type = "media"
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

        this.teamDropdown = document.createElement("select")
        this._header.name.insertAdjacentElement("beforebegin", this.teamDropdown)
        for (let num of Object.keys(team_data)) {
            let team = document.createElement("option")
            team.value = num
            team.innerText = num + " " + team_data[num].Name
            this.teamDropdown.appendChild(team)
        }
        this.teamDropdown.addEventListener("change", () => {
            this.setTeam(this.teamDropdown.value)
        })

        if (Object.keys(team_data).includes('4915')) this.setTeam('4915')
        else this.setTeam(Object.keys(team_data)[0])
    }
    setTeam(team) {
        if (this.activeMedia !== null) this.activeMedia.remove()
        this.activeMedia = null
        this.activeMediaType = ""

        if (usingTBA) {
            this.name = team + " " + team_data[team].Name + " Media"
        } else {
            this.name = this.name + ", " + team + " Media"
        }

        this.previous.disabled = team_data[team]["media"].length === 0
        this.next.disabled = team_data[team]["media"].length === 0

        this.mediaOn = 0
        this.team = team

        this.setMedia()

        this.refresh()
        this.teamDropdown.value = team
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
            // TODO add youtube support
        }
    }

    out() {
        return super.out({
            team: this.team,
            mediaOn: this.team,
        })
    }
}

class Comments extends Widget {
    constructor() {
        super()

        this.type = "comments"
        this.minWidth = 100
        this.minHeight = 70

        this.teamDropdown = document.createElement("select")
        this._header.name.insertAdjacentElement("beforebegin", this.teamDropdown)
        for (let num of Object.keys(team_data)) {
            let team = document.createElement("option")
            team.value = num
            team.innerText = num + " " + team_data[num].Name
            this.teamDropdown.appendChild(team)
        }
        this.teamDropdown.addEventListener("change", () => {
            this.setTeam(this.teamDropdown.value)
        })

        if (Object.keys(team_data).includes('4915')) this.setTeam('4915')
        else this.setTeam(Object.keys(team_data)[0])
    }
    setTeam(team) {
        this.content.innerHTML = ""

        let content = this.content
        function findComments(context, schema, nameOverride) {
            let group = document.createElement("div")
            group.label = nameOverride ?? getColumnFromID(context).name
            for (let child of Object.keys(schema)) {
                if (typeof schema[child]["type"] === "undefined") {
                    findComments(context + "`" + child, schema[child], undefined)
                }
                else if (schema[child]["type"] === "comment") {
                    let col = getColumnFromID(context + "`" + child)

                    let el = document.createElement("div")

                    let open = true

                    let label = document.createElement("div")
                    label.className = "comment-title"
                    label.addEventListener("click", () => {
                        open = !open
                        opener.innerText = open ? "arrow_drop_up" : "arrow_drop_down"
                        notes.classList.toggle("hidden")
                    })
                    el.appendChild(label)

                    let opener = document.createElement("div")
                    opener.className = "material-symbols-outlined"
                    opener.innerText = "arrow_drop_up"
                    label.appendChild(opener)

                    let title = document.createElement("div")
                    title.innerText = col.name
                    title.className = "comment-title-text"
                    label.appendChild(title)

                    let notes = document.createElement("div")
                    notes.className = ""
                    el.appendChild(notes)

                    let text = ""
                    for (let x of Object.values(col.data[team])) {
                        text += x + "\n\n"
                    }
                    notes.innerText = text.trim()
                    content.appendChild(el)
                }
            }
        }
        for (let schema of Object.keys(mapping)) {
            findComments(schema, mapping[schema].data, mapping[schema]["alias"] ?? schema)
        }

        if (usingTBA) {
            this.name = team + " " + team_data[team].Name + " Comments"
        } else {
            this.name = this.name + ", " + team + " Comments"
        }
        this.teamDropdown.value = team
    }

    out() {
        return super.out({
            team: this.teamDropdown.value
        })
    }
    in(a) {
        let team = a["team"]
        delete a["team"]
        super.in(a)
        this.setTeam(team)
    }

}

class Matches extends Widget {
    constructor() {
        super()

        this.type = "matches"
        this.minWidth = 250
        this.minHeight = 70

        this.teamDropdown = document.createElement("select")
        this._header.name.insertAdjacentElement("beforebegin", this.teamDropdown)
        for (let num of Object.keys(team_data)) {
            let team = document.createElement("option")
            team.value = num
            team.innerText = num + " " + team_data[num].Name
            this.teamDropdown.appendChild(team)
        }
        this.teamDropdown.addEventListener("change", () => {
            this.setTeam(this.teamDropdown.value)
        })

        if (Object.keys(team_data).includes('4915')) this.setTeam('4915')
        else this.setTeam(Object.keys(team_data)[0])
    }
    setTeam(team) {
        this.content.innerHTML = ""

        let matchHolder = document.createElement("div")
        matchHolder.className = "match-holder"
        this.content.appendChild(matchHolder)

        if (usingTBA) {
            this.name = team + " " + team_data[team].Name + " Matches"

            let upcoming = false
            for (let num of Object.keys(matches).sort((a,b) => a - b)) {
                let match = matches[num]
                if (match.teams.includes(team)) {
                    // Upcoming Check
                    if (!match["done"] && !upcoming) {
                        upcoming = true
                        let upcomingWarning = document.createElement("div")
                        upcomingWarning.className = "matches-upcoming"
                        upcomingWarning.innerText = "Upcoming Matches"
                        matchHolder.appendChild(upcomingWarning)
                    }

                    let matchEl = document.createElement("div")
                    matchEl.className = "match"

                    let includeAlliance = "blue"

                    // TODO add way to watch video in-app

                    let numHolder = document.createElement("div")
                    numHolder.className = "match-score-holder"
                    matchEl.appendChild(numHolder)

                    let matchNum = document.createElement("a")
                    matchNum.className = "match-number"
                    matchNum.innerText = num
                    matchNum.href = "https://www.thebluealliance.com/match/" + eventKey + "_qm" + num
                    matchNum.target = "_blank"
                    matchNum.rel = "noopener noreferrer"
                    numHolder.appendChild(matchNum)

                    let allianceHolder = document.createElement("div")
                    allianceHolder.className = "match-alliance-holder"
                    matchEl.appendChild(allianceHolder)

                    let redAlliance = document.createElement("div")
                    redAlliance.className = "match-alliance red"
                    for (let t of match.red) {
                        let tEl = document.createElement("div")
                        tEl.className = "match-alliance-team"
                        tEl.innerText = t
                        if (t == team) {
                            includeAlliance = "red"
                            tEl.style.order = "-1"
                        }
                        if (match["winner"] === "red") tEl.style.fontWeight = "bold"
                        redAlliance.appendChild(tEl)
                    }

                    let blueAlliance = document.createElement("div")
                    blueAlliance.className = "match-alliance blue"
                    for (let t of match.blue) {
                        let tEl = document.createElement("div")
                        tEl.className = "match-alliance-team"
                        tEl.innerText = t
                        if (t == team) {
                            tEl.style.order = "-1"
                        }
                        if ("blue" === match["winner"]) tEl.style.fontWeight = "bold"
                        blueAlliance.appendChild(tEl)
                    }

                    if (!upcoming) {
                        let scoreHolder = document.createElement("div")
                        scoreHolder.className = "match-score-holder"
                        matchEl.appendChild(scoreHolder)

                        let redScore = document.createElement("div")
                        redScore.className = "match-score"
                        redScore.innerText = match["redScore"]
                        scoreHolder.appendChild(redScore)

                        let blueScore = document.createElement("div")
                        blueScore.className = "match-score"
                        blueScore.innerText = match["blueScore"]
                        scoreHolder.appendChild(blueScore)

                        ;(includeAlliance === "blue" ? blueScore : redScore).style.order = "-1"
                    }

                    ;(includeAlliance === "blue" ? blueAlliance : redAlliance).style.order = "-1"

                    let statusIcon = document.createElement("div")
                    statusIcon.className = "match-status-icon"

                    if (includeAlliance === match["winner"]) {
                        statusIcon.innerText = "trophy"
                    } else if (match["winner"] === "") {
                        statusIcon.innerText = "balance"
                    } else {
                        statusIcon.innerText = "skull"
                    }

                    allianceHolder.appendChild(redAlliance)
                    allianceHolder.appendChild(blueAlliance)

                    matchHolder.appendChild(matchEl)
                }
            }
        } else {
            this.name = this.name + ", " + team + " Matches"
        }
        this.teamDropdown.value = team
    }

    out() {
        return super.out({
            team: this.teamDropdown.value
        })
    }
    in(a) {
        let team = a["team"]
        delete a["team"]
        super.in(a)
        this.setTeam(team)
    }
}
