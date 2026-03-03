# Orpheus Handbook

Orpheus is FRC Team 4915 Spartronics' scouting data analysis tool.

## 1. Introduction

Orpheus is FRC game-agnostic, so it should hopefully work with any year, regardless of if it is updated or not. All year-specific things are included in a data mapping that tells Orpheus how to process your team's data.

Orpheus' features:
- Modular widget-based UI for infinite customization and faster strategy discussions
   - Tables
   - Graphs
   - Team Info
   - Images
   - Comments
   - Matches
- Save teams to a list for easier comparisons and keeping easier track of them
- TheBlueAlliance and Statbotics integrations
- Supports wide varieties of data with user-created data mappings
- and more!

Orpheus is still under active development but should be usable. It is also improving rapidly.

## 2. Initial Setup

1. Create a data mapping or use the demo mapping
2. Upload the data mapping into Orpheus in the "Data" menu
3. Upload your data in the "Data" menu
4. Set the event key in the "Data" menu. The demo data is for "2025waahs"

## 3. Creating your mapping

The mapping is a JSON file that tells Orpheus how to use your data. If you are not familiar with JSON, it is a file format where data is stored in a key/value pair. Please familiarize yourself with JSON before continuing.

Here is a quick example mapping:
```json5
{
  "mapping_version": 2,
  "game": {
    "year": 2025,
  },
  "data": {
    "match": {
      "alias": "Match Data",
      "input_format": "match",
      "match_key": "Match Number",
      "team_key": "Team Number",

      "functions": {
        "autoCoral": {
          "returns": "[Auto L4 Coral] + [Auto L3 Coral] + [Auto L2 Coral] + [Auto L1 Coral]"
        }
      },

      "constants": {
        "testConstant": 5
      },

      "data": {
          "Coral Scored": {
            "type": "number",
            "summarize": "average",
            "table": "Av. Coral Scored",
            "graph": true,
            "formula": "[L4 Coral] + [L3 Coral] + [L2 Coral] + [L1 Coral] + autoCoral()"
          },
      },
    },
    "pit": {
      "input_format": "team",

      "team_key": "Team Number",

      "data": {
        "Drivetrain": {
          "type": "text",
          "formula": "[What kind of drivetrain do you have?]",
          "table": true
        },
      }
    }
  }
}
```

### 3.1 Mapping Version

The mapping version should be set to whatever version of mapping you are using. Right now, the only supported version is 2. This is here to future-proof Orpheus for backwards-compatibility.

### 3.2 Game Mapping

The game mapping has basic information on what the FRC game is for the year. Orpheus is game-agnostic, so it should work for any year where TBA has match results. In the future, the game mapping will also have information on ranking points

### 3.3 Keys in your Data

Something important for Orpheus mappings is that you submit data that is in either JSON or CSV format. If you submit JSON data, it cannot have nested data.

When keys are mentioned later on in this documentation, it is referring to the key to access the specific datapoint in your data. For example, if you had the following CSV and wanted L4 Coral, the key would be `l4`.

```csv
team,match,l4,l3,l2,l1,autol4,autol3,autol2,autol1
4915,1,5,5,5,5,5,5,5,5
```

### 3.4 Mapping Schemas (Data)

The top-level data key contains further JSONs for each type of data you are adding (called a schema).

For example, in the example mapping we have both "match" and "pit" schemas. If you were doing just match scouting, you'd only have match scouting. If you also were scouting human players (maybe like how many algae they scored), you could also have a JSON object for that. You can have as few or as many as you need.

Inside of each, there are a few things you will have:
```json5
{
   // Required Fields
   "input_format": "match" OR "team", // What type of data this is
   "team_key": "", // The key to the team number in your data. Values must be any of these values: 4915, frc4915, or "Red 1". Using position, such as "Red 1" requires that input_format is "match".
   "data": {} // Includes all columns and information. More on this in 3.5 Columns and Data
   
   // Required for input_format "match".
   "match_key": "", // The key to the match number. This must be a number, like 1, 2, or 53.
   
   // The following fields are optional
   "alias": "", // Changes the visible name inside of Orpheus. Defaults to whatever the key for this object is, which is also the internal name.
   "functions": {}, // Allows you to make custom functions to simplify your data processing later on.
   "constants": {}, // Allows you to define constants that'll be used later on. Maybe useful for point values or RP thresholds
}
```

### 3.5 Columns and Data

The data key for each schema contains various columns/datapoints that you'll be able to view in Orpheus. You can also further organize this section a folder-like structure, as shown below.

```json5
{
   "column1": { ... },
   "column2": { ... },
   "column3": { ... },
   "folder name": {
      "column4": { ... },
      "column5": { ... },
      "column6": { ... },
   },
   "column7": { ... },
}
```

Each column has a "type".

Each column can have an optional `alias` with a more readable name, like how schemas can. This is true for all types and will be left off the following sections to avoid unnecessary repetition.

### 3.6 Numeric Column Types

Every numeric column has a `table` field which can be `true`, `false`, or a string with a specific readable name to be displayed specifically on a table.

Also, numeric columns can be graphed if `graph` is `true`. You can also change it to string if you want a specific graph name for that column.

All numeric columns also have `summarize` field which tells Orpheus how the data should be summarized into one value (like for display on a table). This is optional and defaults to `mean` for all types except `ratio`.
The types are mostly self-explanatory, but they are:
 - `mean`
 - `average` (the mean)
 - `min`
 - `max`
 - `sum` (Adds up all values)
 - `ratio` Adds up a numerator and a denominator for all values to get a common ratio. Only works for `ratio` column type and is the default for `ratio`.

Geometric mean, median, and mode will be added in the future.

#### 3.6.1 Number
The `number` type is for generic number values.

```json5
{
   "type": "number",
   "formula": "",
}
```

#### 3.6.2 Ratio
The `ratio` type is for comparing two values easily. The numerator and denominator are added separately.

If `summarize` is set to `ratio`, which is the default for `ratio` typed columns if not defined, then the numerator and denominator are added up across all the matches and a final ratio computed from that.

If `summarize` is set to anything else, then the ratio is computed on a per-match basis and then the normal summarization occurs.

```json5
{
   "type": "ratio",
   "numerator": Formula for numerator,
   "denominator": Formula for denominator,
}
```

#### 3.6.3 Accuracy
The `accuracy` type

**With accuracy, only use summarization type `mean` or `sum`. It does not support graphs currently.** Both mean and sum will take the absolute value of the error (expected - formula) to determine the value.

```json5
{
   "type": "accuracy",
   "expected": Expected value,
   "formula": Actual value,
}
```

### 3.7 Non-numeric types

#### 3.7.1 Text
The `text` type should only be used on schemas that have `input_format` `team`.

```json5
{
   "type": "text",
   "formula": ""
}
```

#### 3.7.2 Media
The `media` type is for image URLs to be shown in the team media widget.

```json5
{
   "type": "text",
   "key": [JSON Array of image URL keys]
}
```

#### 3.7.3 Comment
The `comment` type will show up in the team comment widget.

```json5
{
   "type": "comment",
   "key": "",
   "scouter_key": "" // Optional, will include the scouter's name in the comment so you can follow-up on the comment if needed.
}
```

### 3.8 Formulas

Formulas are used in all the column types except for those which use only a key. They are mathematical formulas for processing the data.

The primary thing to know is that in order to get a value, you put the key in square brackets, like so: `[key]`. This is also how you get a user-defined constant, `[constant]`.

#### 3.8.1 TBA Integration

You can get information from The Blue Alliance (this will only compute when TBA Matches is enabled and the match data is synced) in a similar way. First, you need to add `tba.` as a prefix. For example:

`[tba.teleopReef.tba_topRowCount]` would return the tba_topRowCount field inside the teleopReef part of the match breakdown.
`[tba.netAlgaeCount]` would return the algae amount scored by the alliance.

See the [TBA API documentation](https://www.thebluealliance.com/apidocs/v3) for their Match Breakdown schemas (at the bottom of the page).

You can also get data from a specific alliance by doing `tba.ALLIANCE COLOR.key` where alliance color is either `blue` or `red`.

#### 3.8.2 Dynamic Stuff

If anyone has a better name to describe this, let me know. These are automatically replaced with the information they represent.

| Dynamic Thing | What does it do?                                       |
|---------------|--------------------------------------------------------|
| #team#        | Team number                                            | 
| #alliance#    | The robot's alliance: `blue` or `red`                  |
| #position#    | The robot's position on the field. Such as 1, 2, or 3. |
| #match# | The match number                                       |

One potential use case for this is to automate climb data or auto leave data.
For example, you could get if a robot left the starting line in 2025 with the expression `[tba.#alliance#.autoLineRobot#position#]`

#### 3.8.3 Strings

You can also put strings in your expressions. Strings are pieces of text wrapped in "quotes". In JSON, remember to put a backslash beforehand, like this: `\"string\"`.

#### 3.8.4 Functions

Functions can be called with the format `function(param1, param2, ... paramN-1, paramN)`

You can define custom functions on a per-schema basis. They automatically are given the same context when called as they would be when put in the plain formula. Here are two examples of custom functions:
```json5
"customAdd": {
  "params": ["a","b"],
  "returns": "[a] + [b]"
},
"teleopCoral": {
  "returns": "[L4 Coral] + [L3 Coral] + [L2 Coral] + [L1 Coral]"
},
  ```

There's a lot of built in functions. You can see the full list [here](https://mathjs.org/docs/reference/functions.html). Please note that you should not include the `math.` part in your expressions/formulas.

#### 3.8.5 Comparisons

You can do comparisons with relational functions, as shown in the above link.

The general format for an IF statement is this:
`CONDITION ? True Value : False Value`

Here is an example from 2025 for climb points, ignoring parking:
`equal([tba.endGameRobot#position#],"DeepCage") ? 12 : (equal([tba.endGameRobot#position#],"ShallowCage") ? 6 : 0)`

## 4. Using Orpheus

### 4.1 Widgets

Orpheus' UI is made up of various "widgets". Each widget can be moved around and resized, and you can add more widgets with the `Widget` menu at the top.

#### 4.1.1 Table Widget

Objectively the most important widget, Tables display data where each row is a team and there are various columns available. 

You can resize each column by dragging the line to the right of them on the table header.

You can move columns around by clicking and dragging them with the 2x3 grid of dots at the top of the table header.

The selected column will be highlighted in a different color. You can select a different column by clicking on it. Tables are sorted by the active column. Clicking on the selected column will reverse the sort.

You can change which teams are shown by clicking the eye icon at the top of the table widget. More information on this will be in 4.2 Lists.

To the right of the eye icon is an icon to open a menu to add additonal columns to the table. 

#### 4.1.2 Graph Widget

Select a column to graph with the dropdown and teams with the eye icon.

You can click and hold on a team in the legend at the bottom to focus on that team's points and lines.

#### 4.1.3 Team Info Widget

Select a column to graph with the dropdown and teams with the eye icon. This widget has generic information about a team and is mostly irrelevant if TBA is turned off.

#### 4.1.4 Team Media Widget

Select a team to view images published to The Blue Alliance or part of your data.

#### 4.1.5 Team Comments Widget

Select a team to view all `comment` typed columns from your data

#### 4.1.6 Team Matches Widget

Select a team to view all of a team's matches. This kinda requires TBA matches.

### 4.2 Lists

You can add teams to a List for easier sorting.

### 4.3 Saved layouts

In the `Layout` menu at the top, you can save and load a layout for later. This feature is still a bit buggy and you can currently only save one layout at a time.

## 5. Upcoming Features

The following features (in no particular order) are planned and should be coming soon(ish):

 - Mobile support
 - Refer to other data from within a schema
   - For example something like hopper size from pit scouting used in match scouting
 - Watch match/team videos from within Orpheus
 - Bar charts
 - Weighted matches (make first __ amount of matches in a competition lower weight for averages)
 - Better offline support and automated API enabling/disabling
 - Optionally load data from an API in place of manual uploads
 - Media widget that shows multiple teams
 - Ranking points shown in matches widget
 - Conditional skipping of match eval
   - For example you could have a climb success % where only matches where a robot attempts climbing is counted
