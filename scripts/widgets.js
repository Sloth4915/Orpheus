class Table extends Widget {
    constructor() {
        super();
        this.name = "Table"

        this.columns = []
        this.teams = []
        this.activeColumn = ""
        this.sort = 1

        this.content.classList.add("table")

        this.header = document.createElement("div")
        this.header.classList.add("row", "header")
        this.content.appendChild(this.header)

        this.columnDragIndicator = document.createElement("div")
        this.columnDragIndicator.className = "data-drag-indicator"
        this.header.appendChild(this.columnDragIndicator)

        this.minWidth = 400
        this.minHeight = 280
    }
    addColumn(...[columns]) {
        if (typeof columns === "string") columns = [columns]
        for (let column of columns) {
            let data = column.split("`")[0]
            let location = column.split("`").slice(1)

            let col
            if (data === "orpheus") {
                col = internalMapping
                for (let x of location) col = col[x]
            }
            else {
                console.log(data)
                col = mapping[data]["data"]
                for (let x of location) col = col[x]
            }

            let dataCol = processedData[data]["data"]
            for (let x of location) dataCol = dataCol[x]

            let name = col["alias"] ? col["alias"] : column.split("`")[column.split("`").length - 1]

            this.columns.push({
                columnId: column,
                name: name,
                mapping: col,
                size: 110, // Pixels
                data: dataCol,
                order: this.columns.length, // Left to right
            })
            let thisColumn = this.columns[this.columns.length - 1]

            for (let team of this.teams) {
                let dataEl = document.createElement("div")
                dataEl.className = "data"
                dataEl.setAttribute("data-column", column)
                dataEl.setAttribute("data-team", team)
                dataEl.setAttribute("data-id", this.id)

                let value = typeof dataCol[team] === "object" ? dataCol[team]["summarized"] : dataCol[team]
                if (typeof value === "number") dataEl.innerText = (Math.round(value * rounding) / rounding) + ""
                else dataEl.innerText = value
                document.querySelector(`.row[data-team="${team}"][data-id="${this.id}"]`).appendChild(dataEl)
            }

            let headerEl = document.createElement("div")
            headerEl.className = "data header"
            headerEl.setAttribute("data-column", column)
            headerEl.setAttribute("data-id", this.id)
            headerEl.innerText = name
            headerEl.addEventListener("click", () => {
                this.setActiveColumn(column)
            })
            this.header.appendChild(headerEl)

            //#region Resizing
            let colResizer = document.createElement("div")
            colResizer.className = "data-resizer"
            colResizer.setAttribute("data-column-size", column)
            colResizer.setAttribute("data-id", this.id)
            let resizing = false
            let index = this.columns.length - 1
            colResizer.addEventListener("mousedown", () => resizing = true)
            document.body.addEventListener("mousemove", (e) => {
                if (!resizing) return
                this.columns[index].size = Math.max(this.columns[index].size + e.movementX, 70)
                e.preventDefault()
                window.getSelection().empty()
                this.refresh()
            })
            document.body.addEventListener("mouseup", () => resizing = false)
            document.body.addEventListener("mouseleave", () => resizing = false)
            this.header.appendChild(colResizer)
            //#endregion

            //#region Dragging
            let colDragger = document.createElement("div")
            colDragger.className = "data-dragger material-symbols-outlined"
            colDragger.setAttribute("data-column-drag", column)
            colDragger.setAttribute("data-id", this.id)
            colDragger.innerText = "drag_indicator"

            let dragging = false
            let dragData = {
                column: null,
                insertBefore: null
            }
            colDragger.addEventListener("mousedown", () => {
                dragging = true
                colDragger.classList.add("dragging")
                for (let col of this.columns) col.order *= 2
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
                    column,
                    insertBefore
                }
            })
            document.body.addEventListener("mouseleave", () => dragging = false)
            document.body.addEventListener("mouseup", (e) => {
                if (!dragging) return
                dragging = false
                this.columnDragIndicator.style.order = "0"

                if (dragData.insertBefore) {
                    thisColumn.order = dragData.column.order - 1
                } else {
                    thisColumn.order = dragData.column.order + 1
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

    }
    getColumnById(id) {
        for (let col of this.columns)
            if (col.columnId === id) return col
        return null
    }
    addTeam(...[teams]) {
        for (let team of teams) {
            this.teams.push(team)

            let teamEl = document.createElement("div")
            teamEl.className = "row"
            teamEl.setAttribute("data-team", team)
            teamEl.setAttribute("data-id", this.id)

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

            this.content.appendChild(teamEl)
        }

        this.refresh()
    }
    removeTeam(...[teams]) {

    }
    setTeams(...[teams]) {

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

        // Sorting
        let teams = [...this.teams]
        let data = this.getColumnById(this.activeColumn).data
        teams.sort((a, b) => {
            let valA = typeof data[a] === "object" ? data[a]["summarized"] : data[a]
            let valB = typeof data[b] === "object" ? data[b]["summarized"] : data[b]

            if (typeof valA === "string" || typeof valB === "string") return (""+valA).toLowerCase().trim() === (""+valB).toLowerCase().trim() ? 0 : (""+valA).toLowerCase().trim() > (""+valB).toLowerCase().trim() ? 1 : -1
            return valA - valB
        })
        if (this.sort === -1) teams.reverse()
        for (let team in teams) {
            document.querySelector(`[data-team="${teams[team]}"][data-id="${this.id}"]`).style.order = team
        }
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
    }
}
