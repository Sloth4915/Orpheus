"use strict";

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
        this.teams = Object.keys(team_data).map((a) => (a + ""))
        for (let team of this.teams) this.addTeamEl(team)
        this.sort = 1

        /**
         * Are all teams shown or just those with a list enabled in the table's scope?
         */
        this.showAll = true
        this.scope = {}
        for (let list of Lists.lists) {
            this.scope[list.id] = List.Sort.LIST_DEFAULT
        }
        this.scopePanel = element("dialog", "table-scope-holder")
        this.content.appendChild(this.scopePanel)

        Events.on(Events.SET_LISTS_MODE, () => {
            if (List.red !== null) {
                this.scope[List.red.id] = List.red.sort
                this.scope[List.blue.id] = List.blue.sort
            }
            this.hardRefresh()
        }, this)
        Events.on(Events.LIST_CHANGE, this.sortRows, this)
        Events.on(Events.DATA_PROCESSED, this.onDataProcessed, this)

        this.content.classList.add("table")

        this.header = element("div", "row header", {}, this.content)

        // Unused in header but there for spacing
        element("div", "table-settings-block", {"data-id": this.id}, this.header)

        this.addHeaderIcon("visibility", "Scope", this.scopePanel, this.openScopeEditor)
        this.addHeaderIcon("view_column", "Columns", this.scopePanel, this.openColumnEditor, [0, 60])

        this.columnDragIndicator = element("div", "data-drag-indicator", {"style": {"order": "-99"}}, this.header)

        if (usingTBAMedia) {
            element("div", "table-logo placeholder", {}, this.header)
            this.hasAddedMedia = true
        }

        this.aboveDivider = element("div", "divider-above hidden", {}, this.content)

        this.belowDivider = element("div", "divider-below hidden", {}, this.content)

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
                size: column["size"] ?? (mobile ? 160 : 110), // Pixels
                data: column.data,
                order: column["order"] ?? this.columns.length, // Left to right
            })
            let thisColumn = this.columns[this.columns.length - 1]

            column.id = column.id ?? column.columnId

            this.elements[thisColumn.columnId] = {}

            for (let team of this.teams) {
                this.teamElements[team].appendChild(this.createTableCell(team, column))
            }

            let headerEl = element("div", "data header", {"data-column": column.id, "innerText": column.table, "data-id": this.id}, this.header)
            this.elements[thisColumn.columnId]["header"] = headerEl
            headerEl.addEventListener("click", () => {
                this.setActiveColumn(column.id)
            })

            let controls = element("div", "data-controls", {}, headerEl)

            //#region Resizing
            let colResizer = element("div", "data-resizer", {}, this.header)
            this.columnResizers[column.id] = colResizer
            let resizing = false
            let index
            let ctx = this
            addDownEvent(colResizer, () => {
                resizing = true
                index = this.indexOfColumn(column.id)
            })
            addMoveEvent((e) => {
                if (!resizing) return
                ctx.columns[index].size = Math.max(ctx.columns[index].size + e.movementX, 70)
                window.getSelection().empty()
                ctx.refresh()
                ctx.setTextSizes(ctx.columns[index])
                if (!mobile) e.raw.preventDefault()
            })
            addUpEvent(() => resizing = false)
            addCancelEvent(() => resizing = false)
            //#endregion

            //#region Dragging
            let colDragger = element("div", "data-dragger material-symbols-outlined", {"data-column-drag": column.id, "data-id": this.id, "innerText": "drag_indicator"})

            let dragging = false
            let dragData
            let dragRemovalEl

            addDownEvent(colDragger, (e) => {
                dragData = {
                    column: null,
                    insertBefore: null,
                }
                dragging = true
                colDragger.classList.add("dragging")
                for (let col of ctx.columns) col.order *= 2

                if (ctx.columns.length > 1) {
                    dragRemovalEl = element("div", "table-column-drag-remove material-symbols-outlined", {"innerText": "delete", "style": {"left": (e.clientX - getRem(2)) + "px", "top": (e.clientY + getRem(3)) + "px"}}, ctx.content)
                }
                ctx.refresh()
            })
            addMoveEvent((e) => {
                if (!dragging) return

                let target
                if (mobile) {
                    let x = e.clientX
                    if (this.columns.length <= 1) return
                    for (let col of this.columns) {
                        let head = this.elements[col.columnId]["header"]
                        let bound = head.getBoundingClientRect()

                        if (bound.left < x && x < bound.right) {
                            target = head
                        }
                    }
                } else target = e.raw.target

                if (typeof target === "undefined") return

                let column = ctx.getColumnById(target.getAttribute("data-column"))
                let insertBefore = target.offsetLeft + target.offsetWidth / 2 > e.clientX
                if (column === null) return

                if (insertBefore) ctx.columnDragIndicator.style.order = ((column.order * 2) + 99) + ""
                else ctx.columnDragIndicator.style.order = ((column.order * 2) + 101) + ""

                dragData = {
                    "column": column,
                    insertBefore
                }
            })
            function dragCancel() {
                dragging = false
                ctx.columnDragIndicator.style.order = "-999"
                if (dragRemovalEl !== undefined) {
                    dragRemovalEl.remove()
                    dragRemovalEl = undefined
                }
            }
            function dragComplete(cx, cy) {
                if (!dragging) return
                dragging = false
                ctx.columnDragIndicator.style.order = "-999"

                if (dragData.column !== null) {
                    let removalBounds = dragRemovalEl.getBoundingClientRect()
                    if (removalBounds.left < cx && cx < removalBounds.right && removalBounds.top < cy && cy < removalBounds.bottom) {
                        ctx.removeColumn(thisColumn.columnId)
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

                ctx.refresh()
            }

            document.body.addEventListener("mouseleave", dragCancel)
            document.body.addEventListener("touchcancel", dragCancel)
            document.body.addEventListener("mouseup", (e) => {
                dragComplete(e.clientX, e.clientY)
            })
            document.body.addEventListener("touchend", (e) => {
                dragComplete(e.changedTouches[0].clientX, e.changedTouches[0].clientY)
            })
            //#endregion

            controls.appendChild(colDragger)

            if (!mobile) {
                let removeButton = element("div", "column-header-button material-symbols-outlined", {"innerText": "cancel_presentation"}, controls)
                removeButton.addEventListener("click", (e) => {
                    e.stopPropagation()
                    this.removeColumn(thisColumn.columnId)
                })
            }
        }

        if (this.activeColumn === "") this.setActiveColumn(this.columns[0].columnId)

        this.refresh()
    }
    removeColumn(...[columns]) {
        if (typeof columns !== "object" || typeof columns[0] === "undefined") columns = [columns]
        console.log(columns)
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
            if (typeof team_data[team] === "undefined") continue
            team = team + ""
            if(this.teams.includes(team + "")) continue
            this.teams.push(team + "")
            this.addTeamEl(team + "")
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

            let teamEl = element("div", "row", {}, this.content)
            this.teamElements[team] = teamEl

            let teamSettingsBlock = element("div", "table-settings-block", {"data-id": this.id}, teamEl)

            let tsChunk = element("div", "table-settings-chunk")
            let num = 0
            for (let i in Lists.lists) {
                num++
                if (num > Lists.lists.length / 2 + 0.5 && Lists.lists.length > 4) {
                    num = 0
                    teamSettingsBlock.appendChild(tsChunk)
                    tsChunk = element("div", "table-settings-chunk")
                }
                let index = parseInt(i)
                let list = Lists.lists[index]

                if (list.hidden) continue

                let listEl = element("div", "table-setting material-symbols-outlined", {"innerText": list.icon, "style": {"color": "", "title": list.name}, "data-list": list.id, "data-team": team, "data-id": this.id}, tsChunk)
                if (list.includes(team)) {
                    listEl.classList.add("filled")
                    listEl.style.color = list.color.color
                }
                listEl.addEventListener("click", () => {
                    list.toggle(team)
                })
            }
            teamSettingsBlock.appendChild(tsChunk)

            for (let column of this.columns) {
                teamEl.appendChild(this.createTableCell(team, column))
            }

            if (usingTBAMedia) {
                let logo = element("img", "table-logo", {"data-team-logo": team, "data-id": this.id}, teamEl)
                if (typeof team_data[team] !== "undefined" && typeof team_data[team].Icon !== "undefined") logo.src = team_data[team].Icon
                else logo.src = MISSING_LOGO
            }
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
            if (this.activeColumn !== "") {
                if (typeof this.elements[this.activeColumn] !== "undefined" && typeof this.elements[this.activeColumn]["header"] !== "undefined")
                    this.elements[this.activeColumn]["header"].classList.remove("selected")
            }
            this.activeColumn = id
            if (typeof this.elements[this.activeColumn] !== "undefined" && typeof this.elements[this.activeColumn]["header"] !== "undefined")
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
                el.style.width = col.size + "px"
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

        let tableWidth = this.header.scrollWidth - 2
        this.aboveDivider.style.width = tableWidth + "px"
        this.belowDivider.style.width = tableWidth + "px"

        Events.emit(Events.SAVE_LAYOUT)
    }
    sortRows() {
        if (this.teams.length === 0 || this.activeColumn === "" || this.parent === null) return
        this.content.scrollTop
        let teams = [...this.teams]
        let data = this.getColumnById(this.activeColumn)
        if (data == null) return
        data = data.data
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
        let dataEl = element("div", "data", {"data-id": this.id})
        this.elements[column.id ?? column.columnId][team] = dataEl


        if (typeof column.data[team] !== "undefined") {
            if (column.mapping.type === "ratio" && (typeof column.mapping["summarize"] === "undefined" || column.mapping["summarize"] === "ratio")) {
                dataEl.innerHTML = ""

                element("div", "numerator", {"innerText": (Math.round(column.data[team]["sum_num"] * rounding) / rounding) + ""}, dataEl)
                element("div", "ratio-divider", {}, dataEl)
                element("div", "denominator", {"innerText": (Math.round(column.data[team]["sum_den"] * rounding) / rounding) + ""}, dataEl)

                dataEl.title = (Math.round(column.data[team]["summarized"] * rounding) / rounding)
            } else {
                let value = (typeof column.data[team] === "object" && column.data[team] !== null) ? column.data[team]["summarized"] : column.data[team]
                if (typeof value === "undefined") dataEl.innerText = ""
                else if (typeof value === "number") dataEl.innerText = (Math.round(value * rounding) / rounding) + ""
                else dataEl.innerText = value
            }
        }

        return dataEl
    }

    openScopeEditor() {
        this.scopePanel.innerHTML = ""

        let panel = element("div", "table-list-scope-edit", {}, this.scopePanel)

        for (let list of Lists.lists) {
            if (list.hidden) continue

            let el = element("div", "list", {}, panel)

            let checkbox = element("input", "", {"type": "checkbox", "checked": typeof this.scope[list.id] !== "undefined"}, el)
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

            let icon = element("div", "material-symbols-outlined filled list-icon", {"innerText": list.icon, "style": {"color": list.color.color}}, el)
            let name = element("div", "", {"innerText": list.name}, el)

            let dropdown = element("select", "", {}, el)
            let options = {
                "Sort Above": List.Sort.SORT_ABOVE,
                "Sort Below": List.Sort.SORT_BELOW,
                "Hide": List.Sort.HIDE,
                "No Change": List.Sort.NO_CHANGE,
            }
            options["List Default (" + Object.fromEntries(Object.entries(options).map(a => a.reverse()))[list.sort] + ")"] = List.Sort.LIST_DEFAULT
            for (let option of Object.keys(options)) {
                element("option", "", {"innerText": option, "value": options[option]}, dropdown)
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
        }

        let showAllHolder = element("div", "", {"style": {"display": "flex", "flex-direction": "row"}}, panel)

        let showAllCheckbox = element("input", "", {"type": "checkbox", "checked": this.showAll, "id": "table-label-checkbox"}, showAllHolder)
        showAllCheckbox.addEventListener("change", () => {
            this.showAll = showAllCheckbox.checked
            this.sortRows()
        })
        showAllHolder.appendChild(showAllCheckbox)

        let showAllLabel = element("label", "", {"innerText": "Show unlisted teams", "for": "table-label-checkbox"}, showAllHolder)
    }
    openColumnEditor() {
        this.scopePanel.innerHTML = ""

        let panel = element("div", "table-column-edit", {}, this.scopePanel)

        let label = element("div", "add-columns-title", {"innerText": "Add Columns"}, panel)

        let columns = element("div", "add-columns", {}, panel)

        function findColumns(context, schema, nameOverride) {
            let group = element("div", "table-column-panel-group", {})

            let open = false

            let groupController = element("div", "table-column-panel-group-controller", {}, group)
            let dropdownButton = element("div", "material-symbols-outlined", {"innerText": "arrow_drop_down"}, groupController)
            let groupName = element("div", "", {"innerText": nameOverride ?? getColumnFromID(context).name}, groupController)
            groupController.addEventListener("click", (e) => {
                open = !open
                dropdownButton.innerText = open ? "arrow_drop_up" : "arrow_drop_down"
                groupColumns.classList.toggle("hidden")
                e.preventDefault()
                window.getSelection().removeAllRanges()
            })

            let groupColumns = element("div", "table-column-panel-columns-holder hidden", {}, group)

            let childHolder = element("div", "child-holder", {}, groupColumns)

            let grandchildHolder = element("div", "grandchild-holder", {}, groupColumns)

            // TODO remove groups when theres no children
            for (let child of Object.keys(schema)) {
                let id = context + "`" + child
                if (typeof schema[child]["type"] === "undefined") {
                    let cEl = findColumns.call(this,id, schema[child], undefined)
                    if (cEl.children[1].children.length) grandchildHolder.appendChild(cEl)
                }
                else if (schema[child]["table"] && !this.includes(id)) {
                    let el = element("div", "table-column-panel-column", {"innerText": getColumnFromID(id).table, "value": id}, childHolder)
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

        // Add icon spot to header, if it doesn't exist yet.
        if (this.hasAddedMedia === undefined && usingTBAMedia) {
            element("div", "table-logo placeholder", {}, this.header)
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

    // Redoes column data
    onDataProcessed() {
        for (let column of this.columns) {
            let newCol = getColumnFromID(column.columnId ?? column.id)
            if (newCol === null) {
                this.removeColumn(column)
                continue
            }
            column.data = newCol.data
        }
        this.hardRefresh()
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
            if (typeof team_data[team] === "undefined") continue
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
        this.onDataProcessed()
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

        this.column = null
        this.teams = []
        this.list = null
        this.selectedTeam = null

        this.allianceMode = List.red !== null
        if (this.allianceMode) {
            this.teams = [...List.red.teams, ...List.blue.teams]
        }

        this.scopePanel = element("dialog", "table-scope-holder", {}, this.content)
        this.addHeaderIcon("visibility", "Scope", this.scopePanel, this.openScopeEditor)

        document.addEventListener("mouseup", () => {
            if (this.selectedTeam == null) return
            this.selectedTeam = null
            this.createExpressions(true)
        })

        this.name = "Select a column to graph"

        this.calcEl = element("div", "graph", {}, this.content)

        this.teamsEl = element("div", "graph-teams", {}, this.content)

        if (usingDesmos) {
            if (desmosReady) this.createCalculator()
            else onDesmosLoad.push(this.createCalculator)
        } else this.calcEl.innerText = "Please enable the Desmos API"

        this.createTeamList()

        Events.on(Events.LIST_CHANGE, () => {
                if (this.list !== null) {
                    this.list = Lists.getFromId(this.list.id)
                    this.teams = JSON.parse(JSON.stringify(this.list.teams))
                    this.redoWidget()
                }
        }, this)
        Events.on(Events.GRAPH_SETTINGS, this.hardRefresh, this)
        Events.on(Events.SET_LISTS_MODE, () => {
            this.allianceMode = List.red !== null
            if (this.allianceMode) this.teams = [...List.red.teams, ...List.blue.teams]
            else if (this.list !== null) this.teams = JSON.parse(JSON.stringify(this.list.teams))
            else this.teams = []
            this.redoWidget()
        }, this)

        let graphDropdown = this.graphDropdown = element("select")
        this._header.name.insertAdjacentElement("beforebegin", graphDropdown)

        function findGraphs(context, schema, nameOverride) {
            let group = element("optgroup", "", {"label": nameOverride ?? getColumnFromID(context).name})
            for (let child of Object.keys(schema)) {
                if (typeof schema[child]["type"] === "undefined") {
                    findGraphs(context + "`" + child, schema[child], undefined)
                }
                else if (schema[child]["graph"]) {
                    let el = element("option", "", {"id": context + "`" + child, "value": context + "`" + child, "innerText": getColumnFromID(context + "`" + child).graph ?? getColumnFromID()}, group)
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
        graphDropdown.value = ""

        this.graphDropdown = graphDropdown
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
        if (!usingDesmos) return
        if (clearExpressions) {
            this.calculator.getExpressions().forEach((expression) => {
                this.calculator.removeExpression(expression)
            })
        }
        if (this.column == null) {
            return
        }
        this.calculator.updateSettings({xAxisLabel: graphSettings.x === "absolute" ? "Event Match #" : "Team Match #", yAxisLabel: this.column.graph})

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
                    console.log(graphSettings.x)
                    if (usingTBAMatches) {
                        if (graphSettings.x === "relative") {
                            if (!Object.keys(team_data[team].TBA.matches).includes(m)) continue
                            else {
                                console.log(Object.keys(team_data[team].TBA.matches))
                                let relativeNumber = Object.keys(team_data[team].TBA.matches).indexOf(""+m) + 1
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

                    if (this.column.type === "accuracy") values.push(this.column.data[team][m]["difference"])
                    else if (this.column.type === "ratio") values.push(this.column.data[team][m]["ratio"])
                    else values.push(this.column.data[team][m])
                }
            }

            this.calculator.setExpression({ id: "x" + team, latex: "x_" + i + " = \\left["+matches+"\\right]" });
            this.calculator.setExpression({ id: "y" + team,  latex: "y_" + i + " = \\left["+values+"\\right]" });
            if (graphSettings.points)
                this.calculator.setExpression({
                    id: "points" + team,
                    latex: "(x_{" + i + "},y_{" + i + "})",
                    color: this.getTeamColor(i),
                    pointStyle: this.getTeamShape(i),
                    pointSize: (this.selectedTeam === null ? 16 : (this.selectedTeam === team ? 18 : 16)),
                    pointOpacity: (this.selectedTeam === null ? 0.8 : (this.selectedTeam === team ? 1 : 0.25)),
                    label: team + " (${x_" + i + "}, ${y_" + i + "})"
                });
            if (graphSettings.bestfit)
                this.calculator.setExpression({
                    id: "line" + team,
                    latex: "y_{" + i + "}\\sim a_{" + i + "}x_{" + i + "}+b_{" + i + "}",
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

        Events.emit(Events.SAVE_LAYOUT)
    }
    createTeamList() {
        this.teamsEl.innerHTML = ""
        for (let i in this.teams) {
            let t = this.teams[i]
            let teamEl = element("div", "graph-team", {}, this.teamsEl)

            if (usingTBAMedia) {
                if (typeof team_data[t] !== "undefined") {
                    let logo = element("img", "graph-logo", {
                        "data-team-logo": t,
                        "data-id": this.id,
                        "src": team_data[t].Icon ?? MISSING_LOGO
                    }, teamEl)
                }
            }

            if (typeof team_data[t] !== "undefined" && typeof team_data[t]["Name"] !== "undefined") {
                element("div", "graph-team-name", {
                    "innerText": this.getShapeSymbol(this.getTeamShape(i)) + " " + (t + " " + team_data[t]["Name"]),
                    "title": this.getShapeSymbol(this.getTeamShape(i)) + " " + (t + " " + team_data[t]["Name"]),
                    "style": {"color": this.getTeamColor(i)}
                }, teamEl)
            }
            else element("div", "graph-team-name", {
                "innerText": this.getShapeSymbol(this.getTeamShape(i)) + " " + (t),
                "title": this.getShapeSymbol(this.getTeamShape(i)) + " " + (t),
                "style": {"color": this.getTeamColor(i)}
            }, teamEl)

            teamEl.addEventListener("mousedown", (e) => {
                e.preventDefault()
                this.selectedTeam = t
                this.createExpressions(true, false)
            })
        }
        if (this.teams.length === 0) this.teamsEl.innerText = "No teams selected"
    }
    getTeamColor(i) {
        let ctx = new OffscreenCanvas(1,1).getContext("2d")
        if (this.allianceMode) {
            if (i < 3) {
                ctx.fillStyle = "oklch(56% 46% "+(50 * i)+")"
            } else {
                ctx.fillStyle = "oklch(56% 46% "+(205 + (45 * (i - 3)))+")"
            }
        } else {
            ctx.fillStyle = "oklch(56% 46% "+((360 / this.teams.length) * (i))+")"
        }
        ctx.fillRect(0,0,1,1)
        return "rgba(" + ctx.getImageData(0,0,1,1).data.join(", ") + ")"
    }
    getTeamShape(i) {
        let shapes = ["POINT", "CROSS", "SQUARE", "PLUS", "TRIANGLE", "DIAMOND", "STAR"]
        return shapes[i % shapes.length]
    }
    getShapeSymbol(i) {
        switch (i) {
            case "POINT": return "⬤"
            case "CROSS": return "✖"
            case "SQUARE": return "■"
            case "PLUS": return "🞦"
            case "TRIANGLE": return "▲"
            case "DIAMOND": return "◆"
            case "STAR": return "★"
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

        let panel = element("div", "graph-list-scope-edit", {}, this.scopePanel)

        if (List.red !== null) {
            let allianceMode = element("div", "", {"innerText": "Alliance mode is enabled"}, panel)
            return
        }

        let listsLabel = element("div", "", {"innerText": "List"}, panel)

        let lists = element("div", "graph-list-of", {}, panel)

        let activeList = null
        for (let list of Lists.lists) {
            let el = element("div", "list", {}, lists)

            let icon = element("div", "material-symbols-outlined filled list-icon", {"innerText": list.icon, "style": {"color": list.color.color}}, el)

            let name = element("div", "", {"innerText": list.name}, el)

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
        }

        let teamsLabel = element("div", "", {"innerText": "Team List"}, panel)

        let teams = element("div", "graph-list-of", {}, panel)

        let context = this
        function addTeamEl(team) {
            let teamEl = element("div", "graph-scope-team", {"innerText": team}, teams)
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
        }

        for (let team of this.teams) {
            addTeamEl(team)
        }

        let addButton = element("button", "", {"innerText": "Add team"}, panel)
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
    }

    out() {
        return super.out({
            teams: this.teams,
            list: this.list,
            column: this.column,
        })
    }
    in(a) {
        super.in(a)
        this.graphDropdown.value = (typeof this.column === "object" && this.column !== null) ? (this.column.id ?? this.column.columnId) : ""
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
        this.allianceMode = List.red !== null

        this.content.classList.add("team-info-widget")

        this.scopePanel = element("dialog", "table-scope-holder", {}, this._header.holder)
        this.addHeaderIcon("visibility", "Scope", this.scopePanel, this.openScopeEditor)
        Events.on(Events.LIST_CHANGE, () => this.onListChange(), this)
        Events.on(Events.SET_LISTS_MODE, () => {
            this.allianceMode = List.red !== null
            this.redoList()
        }, this)
    }
    redoList() {
        this.content.innerHTML = ""

        let teams = this.teams
        if (this.allianceMode) teams = [...List.red.teams, ...List.blue.teams]

        if (teams.length > 0) {
            let name = ""
            for (let team of teams) {
                let imageAndBasicHolderHolder = element("div", "team-info-flex-horizontal", {}, this.content)

                let logo = element("img", "team-info-logo", {"data-team-logo": team, "data-id": this.id}, imageAndBasicHolderHolder)

                let listChunk = element("div", "team-info-list", {}, imageAndBasicHolderHolder)
                listChunk.className = "team-info-list"
                for (let list of Lists.lists) {
                    let listEl = element("div", "table-setting material-symbols-outlined", {"innerText": list.icon, "title": list.name, "data-list": list.id, "data-team": team, "data-id": this.id}, listChunk)
                    if (list.includes(team)) {
                        listEl.classList.add("filled")
                        listEl.style.color = list.color.color
                    }
                    listEl.addEventListener("click", () => {
                        list.toggle(team)
                    })
                }

                let basicInfoHolder = element("div", "team-info-basic-holder", {}, imageAndBasicHolderHolder)

                let nameEl = element("div", "team-info-name", {}, basicInfoHolder)

                let location = element("div", "team-info-basic-text", {}, basicInfoHolder)

                let rookieYear = element("div", "team-info-basic-text", {}, basicInfoHolder)

                let eventRank = element("div", "team-info-basic-text", {}, basicInfoHolder)

                if (usingTBA) {
                    if (teams.length > 1) name = name + ", " + team
                    else name = name + ", " + team + " " + team_data[team].Name

                    if (typeof team_data[team].TBA === "undefined") continue

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

        Events.emit(Events.SAVE_LAYOUT)
    }
    openScopeEditor() {
        this.scopePanel.innerHTML = ""

        let panel = element("div", "graph-list-scope-edit", {}, this.scopePanel)

        if (List.red !== null) {
            element("div", "", {"innerText": "Alliance mode is enabled."}, panel)
            return
        }

        let listsLabel = element("div", "", {"innerText": "List"}, panel)

        let lists = element("div", "graph-list-of", {}, panel)

        let activeList = null
        for (let list of [List.ALL, ...Lists.lists]) {
            let el = element("div", "list", {}, lists)

            let icon = element("div", "material-symbols-outlined filled list-icon", {"innerText": list.icon, "style": {"color": list.color.color}}, el)

            let name = element("div", "", {"innerText": list.name}, el)

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
        }

        let teamsLabel = element("div", "", {"innerText": "Team List"}, panel)

        let teams = element("div", "graph-list-of", {}, panel)

        let context = this
        function addTeamEl(team) {
            let teamEl = element("div", "graph-scope-team", {"innerText": team}, teams)
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
        }

        for (let team of this.teams) {
            addTeamEl(team)
        }

        let addButton = elements("button", "", {"innerText": "Add team"}, panel)
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

        this.controls = element("div", "team-media-controls", {}, this.content)

        this.previous = element("button", "material-symbols-outlined", {"innerText": "arrow_left"}, this.controls)
        this.previous.addEventListener("click", () => {
            this.mediaOn--
            if (this.mediaOn < 0) this.mediaOn = team_data[this.team].media.length + this.mediaOn
            this.setMedia(this)
        })

        this.progress = element("div", "", {}, this.controls)

        this.next = element("button", "material-symbols-outlined", {"innerText": "arrow_right"}, this.controls)
        this.next.addEventListener("click", () => {
            this.mediaOn++
            if (this.mediaOn >= team_data[this.team].media.length) this.mediaOn = 0
            this.setMedia()
        })

        this.content.addEventListener("mouseenter", () => {
            if (team_data[this.team].media.length > 0) this.controls.classList.add("shown")
        })
        this.content.addEventListener("mouseleave", () => {
            this.controls.classList.remove("shown")
        })

        this.mediaOn = 0

        this.teamDropdown = element("select")
        this._header.name.insertAdjacentElement("beforebegin", this.teamDropdown)
        for (let num of Object.keys(team_data)) {
            let team = element("option", "", {"value": num, "innerText": num + " " + team_data[num].Name}, this.teamDropdown)
        }
        this.teamDropdown.addEventListener("change", () => {
            this.setTeam(this.teamDropdown.value)
        })

        if (Object.keys(team_data).includes("4915")) this.setTeam("4915")
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
        Events.emit(Events.SAVE_LAYOUT)
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
            this.activeMedia = element("div", "", {"innerText": "Team " + this.team + " does not have any media"}, this.content)
            this.activeMediaType = "text"
        } else {
            this.progress.innerText = (this.mediaOn + 1) + " / " + team_data[this.team].media.length
            let media = team_data[this.team].media[this.mediaOn]
            if (media.type === "image") {
                this.activeMedia = element("img", "", {"src": media.src}, this.content)
                this.activeMediaType = "image"
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

        this.teamDropdown = element("select")
        this._header.name.insertAdjacentElement("beforebegin", this.teamDropdown)
        for (let num of Object.keys(team_data)) {
            let team = element("option", "", {"value": num, "innerText": num + " " + team_data[num].Name}, this.teamDropdown)
        }
        this.teamDropdown.addEventListener("change", () => {
            this.setTeam(this.teamDropdown.value)
        })

        if (Object.keys(team_data).includes("4915")) this.setTeam("4915")
        else this.setTeam(Object.keys(team_data)[0])
    }
    setTeam(team) {
        this.content.innerHTML = ""

        let content = this.content
        let i = 0
        function findComments(context, schema, addToEl) {
            for (let child of Object.keys(schema)) {
                i++
                if (typeof schema[child]["type"] === "undefined") {
                    findComments(context + "`" + child, schema[child], addToEl)
                }
                else if (schema[child]["type"] === "comment") {
                    let col = getColumnFromID(context + "`" + child)

                    if (typeof col.data[team] !== "undefined") {
                        for (let x of Object.keys(col.data[team])) {
                            if (("" + col.data[team][x]).trim().startsWith("undefined (")) continue

                            let note = element("div", "", {"style": {"order": "" + ((parseInt(x) * 1000) + i)}}, addToEl)
                            let noteCol = element("b", "", {"innerText": col.name + ": "}, note)
                            let content = element("div", "", {"innerText": col.data[team][x].trim()}, note)
                        }
                    }
                }
            }
        }
        for (let schema of Object.keys(mapping)) {
            let el = element("div", "", {}, content)

            let open = true

            let label = element("div", "comment-title", {}, el)
            label.addEventListener("click", () => {
                open = !open
                opener.innerText = open ? "arrow_drop_up" : "arrow_drop_down"
                contents.classList.toggle("hidden")
            })

            let opener = element("div", "material-symbols-outlined", {"innerText": "arrow_drop_up"}, label)

            let title = element("div", "comment-title-text", {"innerText": getColumnFromID(schema).name}, label)

            let contents = element("div", "comment-holder", {}, content)

            findComments(schema, mapping[schema].data, contents)
        }

        if (usingTBA) {
            this.name = team + " " + team_data[team].Name + " Comments"
        } else {
            this.name = this.name + ", " + team + " Comments"
        }
        this.teamDropdown.value = team

        Events.emit(Events.SAVE_LAYOUT)
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

        this.teamDropdown = element("select")
        this._header.name.insertAdjacentElement("beforebegin", this.teamDropdown)
        for (let num of Object.keys(team_data)) {
            let team = element("option", "", {"value": num, "innerText": num + " " + team_data[num].Name}, this.teamDropdown)
        }
        this.teamDropdown.addEventListener("change", () => {
            this.setTeam(this.teamDropdown.value)
        })

        if (Object.keys(team_data).includes("4915")) this.setTeam("4915")
        else this.setTeam(Object.keys(team_data)[0])
    }
    setTeam(team) {
        this.content.innerHTML = ""

        let matchHolder = element("div", "match-holder", {}, this.content)

        if (usingTBAMatches) {
            this.name = team + " " + team_data[team].Name + " Matches"

            let upcoming = false
            for (let num of Object.keys(matches).sort((a,b) => a - b)) {
                let match = matches[num]
                if (match.teams.includes(team)) {
                    // Upcoming Check
                    if (!match["done"] && !upcoming) {
                        upcoming = true
                        let upcomingWarning = element("div", "matches-upcoming", {"innerText": "Upcoming Matches"}, matchHolder)
                    }

                    let matchEl = element("div", "match", {}, matchHolder)

                    let includeAlliance = "blue"

                    // TODO add way to watch video in-app

                    let numHolder = element("div", "match-score-holder", {}, matchEl)

                    let matchNum = element("a", "match-number", {"innerText": num, "href": "https://www.thebluealliance.com/match/" + eventKey + "_qm" + num, "target": "_blank", "rel": "noopener noreferrer"}, numHolder)

                    let allianceHolder = element("div", "match-alliance-holder", {}, matchEl)

                    let redAlliance = element("div", "match-alliance red", {}, allianceHolder)
                    for (let t of match.red) {
                        let tEl = element("div", "match-alliance-team", {"innerText": t}, redAlliance)
                        if (t == team) {
                            includeAlliance = "red"
                            tEl.style.order = "-1"
                        }
                        if (match["winner"] === "red") tEl.style.fontWeight = "bold"
                    }

                    let blueAlliance = element("div", "match-alliance blue", {}, allianceHolder)
                    for (let t of match.blue) {
                        let tEl = element("div", "match-alliance-team", {"innerText": t}, blueAlliance)
                        if (t == team) {
                            tEl.style.order = "-1"
                        }
                        if ("blue" === match["winner"]) tEl.style.fontWeight = "bold"
                    }

                    if (!upcoming) {
                        let scoreHolder = element("div", "match-score-holder", {}, matchEl)

                        let redScore = element("div", "match-score", {"innerText": match["redScore"]}, scoreHolder)
                        let blueScore = element("div", "match-score", {"innerText": match["blueScore"]}, scoreHolder)

                        ;(includeAlliance === "blue" ? blueScore : redScore).style.order = "-1"
                    }

                    ;(includeAlliance === "blue" ? blueAlliance : redAlliance).style.order = "-1"

                    let statusIcon = element("div", "match-status-icon")

                    if (includeAlliance === match["winner"]) {
                        statusIcon.innerText = "trophy"
                    } else if (match["winner"] === "") {
                        statusIcon.innerText = "balance"
                    } else {
                        statusIcon.innerText = "skull"
                    }
                    // TODO put status icon somewhere (maybe low opacity behind match number?)
                }
            }
        } else {
            this.name = team + " Matches"
            matchHolder.innerText = "Currently, TBA Matches must be enabled to see team matches"
        }
        this.teamDropdown.value = team

        Events.emit(Events.SAVE_LAYOUT)
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

class Welcome extends Widget {
    constructor() {
        super()

        this.name = "Orpheus Welcome"

        this.content.classList.add("orpheus-welcome")

        let title = element("h1", "", {"innerText": "Welcome to Orpheus!"}, this.content)

        let description = element("div", "", {"innerText": "Orpheus is 4915's scouting data analysis tool."}, this.content)

        let help = element("a", "", {"innerText": "Orpheus Guide / User Manual", "target": "_blank", "rel": "noopener noreferrer", "href": "https://github.com/Sloth4915/Orpheus/blob/main/README.md"}, this.content)

        let demo2025 = element("button", "", {"innerText": "Load Demo (2025 Reefscape)"})
        demo2025.addEventListener("click", () => {
            Events.on(Events.DATA_PROCESSED, () => {
                let tabGroup = new WidgetTabGroup()

                let table1 = new Table()
                table1.addColumn(["orpheus`number", "orpheus`name", "match`Coral`L1", "match`Coral`L4", "match`Coral`Auto", "match`Coral`Total", "match`Climb Points", "pit`Drivetrain"])
                table1.hardRefresh()

                let teamInfo = new TeamInfo()
                teamInfo.onListChange()
                tabGroup.addChild(teamInfo)

                let teamMedia = new TeamMedia()
                tabGroup.addChild(teamMedia)

                let matches = new Matches()
                tabGroup.addChild(matches)

                tabGroup.addChild(table1, 0)

                let graph = new Graph()
                graph.teams = [4915]
                graph.name = "Graph - " + "Total Coral"
                graph.graphDropdown.value = "match`Coral`Total"
                graph.column = getColumnFromID("match`Coral`Total")
                graph.hardRefresh()

                main.addChild(tabGroup)
                main.addChild(graph, 0.4)
            })

            mapping = demoMapping
            uploadedData["pit"] = demoPit
            uploadedData["match"] = demoData
            eventKey = demoEvent
            gameMapping = {
                "year": 2025
            }

            usingTBA = true
            usingTBAMatches = true
            usingTBAMedia = true

            loadEvent()

            this.parent.removeChild(this)
        })
        this.content.appendChild(demo2025)

        let demo2026 = element("button", "", {"innerText": "Load Demo (2026 Rebuilt)"})
        demo2026.addEventListener("click", () => {

        })
        demo2026.disabled = true
        this.content.appendChild(demo2026)

        let quickSetup = element("button", "", {"innerText": "Quick Setup (Mapping Generator)"})
        quickSetup.addEventListener("click", openMappingGenerator)
        this.content.appendChild(quickSetup)

        let setupChecklist = element("div", "setup-checklist", {}, this.content)

        let checklistTitle = element("b", "", {"innerText": "Setup Checklist"}, setupChecklist)

        let item0 = element("div", "setup-list", {"innerText": "Set your event key"}, setupChecklist)
        if (typeof eventKey !== "undefined") item0.classList.add("strike")
        let item1 = element("div", "setup-list", {"innerText": "Upload a data mapping"}, setupChecklist)
        if (typeof mapping !== "undefined") item1.classList.add("strike")
        let item2 = element("div", "setup-list", {"innerText": "Upload your data"}, setupChecklist)
        if (isDataUploaded()) item2.classList.add("strike")
        setupChecklist.appendChild(item2)
    }
}

class MappingGenerator extends Widget {
    constructor() {
        super();

        this.name = "Mapping Generator"

        this.content.classList.add("mapping-generator")

        let title = element("h1", "", {"innerText": "Mapping Generator"}, this.content)

        let description = element("div", "", {"innerText": "The mapping generator creates a basic data mapping from your data to get you started with Orpheus. WARNING: This feature is experimental and may not be reliable or polished. Currently, it is recommended that you make your mapping manually for full control and feature support."}, this.content)

        let holder = element("div", "generator-holder", {}, this.content)

        let schemaHolder = element("div", "schema-holder", {}, holder)
        let dataHolder = element("div", "data-holder", {}, holder)

        let selectedIndex
        let schemas = []

        let yearHolder = element("div", "", {}, schemaHolder)
        let yearLabel = element("label", "", {for: "mapping-generator-year", innerText: "Year"}, yearHolder)
        let yearInput = element("input", "", {id: "mapping-generator-year", type: "number", min: 2000, max: new Date().getFullYear(), value: new Date().getFullYear()}, yearHolder)

        let addButton = element("button", "", {"innerText": "Add Schema"}, schemaHolder)
        addButton.addEventListener("click", () => {
            let index = schemas.length
            let id = WidgetBase.generateId()
            let schema = element("div", "schema", {}, schemaHolder)
            let nameHolder = element("div", "schema-chunk", {}, schema)
            let fileHolder = element("div", "schema-chunk", {}, schema)
            schema.addEventListener("click", () => selectSchema(index))
            schemas.push({
                schema,
                nameLabel: element("label", "", {for: id+"__name", innerText: "Schema Name"}, nameHolder),
                nameInput: element("input", "", {id: id+"__name", value: "Unnamed Schema"}, nameHolder),
                fileInput: element("button", "", {
                        innerText: "Upload Data",
                        events: {
                            click: function() {
                                loadFile(".csv,.json", (result, filetype) => {
                                    let data
                                    filetype = filetype === "csv" || filetype === "json" ? filetype : prompt("What is the filetype? (csv/json)").toLowerCase().trim()
                                    if (filetype === "csv") data = csvToJson(result) // Converts CSV to JSON
                                    else if (filetype === "json") data = JSON.parse(result) // Parses json
                                    else {
                                        alert("Must be a CSV or JSON file.")
                                        return
                                    }

                                    let mapping = {
                                        "alias": "",
                                        "input_format": "",
                                        "match_key": "",
                                        "team_key": "",
                                        "data": {},
                                        "functions": {},
                                        "constants": {},
                                    }

                                    if (!Array.isArray(data)) {
                                        let validKeys = []
                                        for (let key of Object.keys(data)) {
                                            if (Array.isArray(data[key])) validKeys.push(key)
                                        }

                                        if (validKeys.length === 1) {
                                            mapping["data_holder"] = validKeys[0]
                                            data = data[validKeys[0]]
                                        } else if (validKeys.length === 0) {
                                            alert("There is no array of data entries available in this JSON")
                                            return
                                        } else {
                                            let key = prompt(`What is the key to the array of data entries?\n\nAvailable keys: ${validKeys}`)
                                            if (key === null || !Array.isArray(data[key])) return
                                            mapping["data_holder"] = key
                                            data = data[key]
                                        }
                                    }

                                    let type = ""
                                    if (data.length > 100) type = "match"
                                    else while (type !== "match" && type !== "team") {
                                        type = prompt("Is this schema covering data in just one match or overall? Type 'match' or 'team' without the quotes.")
                                        if (type === null) return
                                        type = type.trim().toLowerCase()
                                    }
                                    mapping["input_format"] = type

                                    let fieldOptions = []
                                    function processData(data, mapping, nesting = "") {
                                        for (let key of Object.keys(data)) {
                                            if (typeof data[key] === "object" && !Array.isArray(data[key])) {
                                                let a = {}
                                                processData(data[key], a, nesting + key + ".")
                                                if (Object.keys(a).length > 0) mapping[key] = a
                                            } else {
                                                fieldOptions.push(`${nesting}${key}`)
                                                if (typeof data[key] === "number" || parseFloat(data[key]) == data[key]) {
                                                    mapping[key] = {
                                                        "alias": key.split(/[-\.]/g).join(" ").split(/(?=[A-Z])/g).map((str) => { return str.trim().charAt(0).toUpperCase() + str.trim().slice(1) } ).join(" "),
                                                        "type": "number",
                                                        "summarize": "average",
                                                        "formula": `[${nesting}${key}]`,
                                                        "graph": true,
                                                        "table": true,
                                                    }
                                                } else if (typeof data[key] === "string") {
                                                    if (type === "match") {
                                                        mapping[key.split(/[-\.]/g).join(" ").split(/(?=[A-Z])/g).map((str) => { return str.trim().charAt(0).toUpperCase() + str.trim().slice(1) } ).join(" ")] = {
                                                            "type": "comment",
                                                            "key": `${nesting+key}`
                                                        }
                                                    } else {
                                                        mapping[key] = {
                                                            "type": "text",
                                                            "alias": key.split(/[-\.]/g).join(" ").split(/(?=[A-Z])/g).map((str) => { return str.trim().charAt(0).toUpperCase() + str.trim().slice(1) } ).join(" "),
                                                            "formula": `[${nesting+key}]`,
                                                            "table": true,
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    for (let entry of data) processData(entry, mapping["data"])

                                    schemas[index].fieldOptions = [...new Set(fieldOptions)]
                                    schemas[index].mapping = mapping
                                    schemas[index].status.innerText = "Data uploaded"
                                    schemas[index].userData = data
                                    selectSchema(index)
                                })
                            }
                        }
                    }, fileHolder),
                status: element("div", "", {innerText: "Please upload a data sample"}, fileHolder),
                removeButton: element("button", "", {
                        innerText: "Remove Schema",
                        events: {
                            click: function() {
                                schemas[index].deleted = true
                                schemas[index].schema.style.display = "none"

                                setTimeout(() => {
                                    let i = 0;
                                    while (i < schemas.length) {
                                        if (!schemas[i].deleted) {
                                            selectSchema(i)
                                            return;
                                        }
                                        i++
                                    }
                                    addButton.click()
                                },0)
                            }
                        }
                    }, schema),
                deleted: false,
                data: null
            })
            selectSchema(index)
        })
        addButton.click()

        function selectSchema(index = selectedIndex) {
            selectedIndex = index
            for (let i in schemas) {
                if (i == index) schemas[i].schema.classList.add("selected")
                else schemas[i].schema.classList.remove("selected")
            }

            let schema = schemas[index]
            let mapping = schema.mapping

            dataHolder.innerHTML = ""
            if (typeof mapping === "undefined") {
                dataHolder.innerText = "Please upload a data sample"
            } else {
                let keyHolder = element("div", "", {}, dataHolder)
                let keyHeader = element("h2", "", {"innerText": "Data Keys"}, keyHolder)
                let keys = element("div", "keys-holder", {"innerText": schema.fieldOptions.join(", ")}, keyHolder)

                let schemaInfo = element("div", "", {}, dataHolder)
                let infoHeader = element("h2", "", {"innerText": "Basic Schema Info"}, schemaInfo)

                let id = WidgetBase.generateId()
                let inputFormatHolder = element("div", "", {}, schemaInfo)
                let inputFormatLabel = element("label", "", {"for": id+"__inputDropdown", innerText: "Input Format"}, inputFormatHolder)
                let inputFormatDropdown = element("select", "", {"id": id+"__inputDropdown"}, inputFormatHolder)
                inputFormatDropdown.addEventListener("change", () => {
                    mapping["input_format"] = inputFormatDropdown.value
                    selectSchema()
                })
                element("option", "", {value: "team", innerText: "Team"}, inputFormatDropdown)
                element("option", "", {value: "match", innerText: "Match"}, inputFormatDropdown)
                inputFormatDropdown.value = mapping["input_format"]

                if (mapping["input_format"] === "match") {
                    let matchKeyHolder = element("div", "", {}, schemaInfo)
                    let matchLabel = element("label", "", {"for": id+"__match", innerText: "Match Key"}, matchKeyHolder)
                    let matchInput = element("input", "", {"id": id+"__match", "value": mapping["match_key"]}, matchKeyHolder)
                    matchInput.addEventListener("change", () => {
                        mapping["match_key"] = matchInput.value
                        selectSchema()
                    })
                }

                let teamKeyHolder = element("div", "", {}, schemaInfo)
                let teamLabel = element("label", "", {"for": id+"__match", innerText: "Team Number Key"}, teamKeyHolder)
                let teamInput = element("input", "", {"id": id+"__match", "value": mapping["team_key"]}, teamKeyHolder)
                teamInput.addEventListener("change", () => {
                    mapping["team_key"] = teamInput.value
                    selectSchema()
                })

                let dataElements = element("div", "data-elements", {}, dataHolder)

                function createDataElements(data, appendTo) {
                    for (let i in data) {
                        let obj = data[i]
                        let id = WidgetBase.generateId()
                        let holder = element("div", "data-element", {}, appendTo)

                        if (typeof obj["type"] === "undefined") {
                            let nameLabel = element("div", "", {innerText: i}, holder)
                            holder.classList.add("list")
                            createDataElements(obj, holder)
                        } else {
                            let removeButton = element("button", "", {"innerText": "Remove"}, holder)
                            removeButton.addEventListener("click", () => {
                                delete data[i]
                                selectSchema()
                            })

                            let typeLabel = element("label", "", {for: id+"__type", innerText: "Type"}, holder)
                            let typeSelect = element("select", "", {id: id+"__name"}, holder)
                            element("option", "", {value: "number", innerText: "Number"}, typeSelect)
                            //element("option", "", {value: "ratio", innerText: "ratio"}, typeSelect)
                            //element("option", "", {value: "accuracy", innerText: "accuracy"}, typeSelect)
                            element("option", "", {value: "text", innerText: "text"}, typeSelect)
                            //element("option", "", {value: "media", innerText: "media"}, typeSelect)
                            element("option", "", {value: "comment", innerText: "Comment"}, typeSelect)
                            typeSelect.addEventListener("change", () => {
                                obj["type"] = typeSelect.value
                                selectSchema()
                            })
                            typeSelect.value = obj["type"]

                            let nameLabel = element("label", "", {for: id+"__name", innerText: "Display Name"}, holder)
                            let nameInput = element("input", "", {id: id+"__name", value: obj["alias"] ?? i}, holder)
                            nameInput.addEventListener("change", () => {
                                let x = JSON.parse(JSON.stringify(data[i]))
                                delete data[i]
                                x["alias"] = nameInput.value
                                if (obj["type"] === "comment") delete x["alias"]
                                data[nameInput.value] = x
                                selectSchema()
                            })

                            let formulaLabel = element("label", "", {for: id+"__formula", innerText: obj["type"] === "comment" ? "Comment Key" : "Formula"}, holder)
                            let formulaInput = element("input", "", {id: id+"__formula", value: obj["formula"] ?? obj["key"]}, holder)
                            formulaInput.addEventListener("change", () => {
                                obj["key"] = formulaInput.value
                            })

                            if (obj["type"] == "number" || (obj["type"] === "text" && mapping["input_format"] == "team")) {
                                let tableLabel = element("label", "", {for: id+"__table", innerText: "Table"}, holder)
                                let tableBox = element("input", "", {id: id+"__table", type: "checkbox", checked: obj["table"]}, holder)
                                tableBox.addEventListener("change", () => {
                                    obj["table"] = tableBox.checked
                                })
                            }
                            if (obj["type"] == "number" && mapping["input_format"] == "match") {
                                let graphLabel = element("label", "", {for: id+"__graph", innerText: "Graph"}, holder)
                                let graphBox = element("input", "", {id: id+"__graph", type: "checkbox", checked: obj["graph"]}, holder)
                                graphBox.addEventListener("change", () => {
                                    obj["graph"] = graphBox.checked
                                })
                            }
                        }
                    }
                }
                createDataElements(mapping.data, dataElements)
            }
        }

        let finish = element("button", "generator-finish", {"innerText": "Generate Mapping"}, schemaHolder)
        finish.addEventListener("click", () => {
            let finalMapping = {}
            uploadedData = {}
            for (let schema of schemas) {
                if (schema.deleted) continue
                let name = schema.nameInput.value.trim()
                let id = name.toLowerCase().replaceAll(/\s/g, "")
                if (Object.keys(finalMapping).includes(id)) {
                    alert("Two schemas may not have the same name")
                    return
                }
                if (typeof schema["mapping"] === "undefined") {
                    alert("Please upload a data sample for all schemas")
                    return
                }
                schema["mapping"]["alias"] = name
                finalMapping[id] = schema["mapping"]
                uploadedData[id] = schema["userData"]
            }

            localforage.setItem(storageKeys.DATA, uploadedData, () => {
                localforage.setItem(storageKeys.MAPPING, {
                    "mapping_version": 2,
                    game: { "year": yearInput.value },
                    data: finalMapping
                }, () => {
                    document.querySelector("#top-load-event").click()
                    document.querySelector("#top-layout-reset").click()
                    setTimeout(() => location.reload(), 0)
                })
            })
        })
    }
}

WidgetBase.WidgetTypes["table"] = Table
WidgetBase.WidgetTypes["graph"] = Graph
WidgetBase.WidgetTypes["info"] = TeamInfo
WidgetBase.WidgetTypes["media"] = TeamMedia
WidgetBase.WidgetTypes["comments"] = Comments
WidgetBase.WidgetTypes["matches"] = Matches