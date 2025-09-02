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
    }
    addColumn(...[columns]) {
        for (let column of columns) {
            let data = column.split("`")[0]
            let location = column.split("`").slice(1)

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

            let name = col["alias"] ? col["alias"] : column.split("`")[column.split("`").length - 1]

            this.columns.push({
                columnId: column,
                name: name,
                mapping: col,
                size: 0.2,
                data: dataCol
            })

            let headerEl = document.createElement("div")
            headerEl.className = "data"
            headerEl.setAttribute("data-column", column)
            headerEl.innerText = name
            this.header.appendChild(headerEl)
        }
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
                data.setAttribute("data-column", column)

                let value = column.data[team]
                if (typeof value === "object") data.innerText = value["summarized"]
                else data.innerText = value
                teamEl.appendChild(data)
            }

            this.content.appendChild(teamEl)
        }
    }
    removeTeam(...[teams]) {

    }
    setTeams(...[teams]) {

    }
    refresh() {
        super.refresh()
    }
}
