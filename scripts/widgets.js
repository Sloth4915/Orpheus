class Table extends Widget {
    constructor() {
        super();
        this.name = "Table"

        this.columns = []
        this.teams = []
        this.activeColumn = "match`Scoring`Coral Scored" // fixme temp

        this.content.classList.add("table")

        this.header = document.createElement("div")
        this.header.classList.add("row", "header")
        this.content.appendChild(this.header)

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
                size: 100, // Pixels
                data: dataCol,
                order: this.columns.length, // Left to right
            })

            for (let team of this.teams) {
                let dataEl = document.createElement("div")
                dataEl.className = "data"
                dataEl.setAttribute("data-column", column)
                dataEl.setAttribute("data-team", team)

                let value = dataCol[team]
                if (typeof value === "object") dataEl.innerText = value["summarized"]
                else dataEl.innerText = value
                document.querySelector(`.row[data-team="${team}"]`).appendChild(dataEl)
            }

            let headerEl = document.createElement("div")
            headerEl.className = "data"
            headerEl.setAttribute("data-column", column)
            headerEl.innerText = name
            this.header.appendChild(headerEl)

            let colResizer = document.createElement("div")
            colResizer.className = "data-resizer"
            colResizer.setAttribute("data-column-pos", column)
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
        }
        this.refresh()
    }
    removeColumn(...[columns]) {

    }
    addTeam(...[teams]) {
        for (let team of teams) {
            this.teams.push(team)

            let teamEl = document.createElement("div")
            teamEl.className = "row"
            teamEl.setAttribute("data-team", team)

            for (let column of this.columns) {
                let data = document.createElement("div")
                data.className = "data"
                data.setAttribute("data-column", column.columnId)
                data.setAttribute("data-team", team)

                let value = column.data[team]
                if (typeof value === "object") data.innerText = value["summarized"]
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
    refresh() {
        super.refresh()

        for (let col of this.columns) {
            let elements = document.querySelectorAll(`[data-column="${col.columnId}"]`)
            for (let el of elements) el.style.width = col.size + 'px'
        }
    }
}
