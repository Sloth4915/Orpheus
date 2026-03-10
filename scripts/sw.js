// Code from https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Tutorials/CycleTracker/Service_workers

const VERSION = "2.1"
const CACHE_NAME = `orpheus-4915-${VERSION}`

const APP_STATIC_RESOURCES = [
    "/",

    // This API key is only allowed for use on Orpheus. If you'd like to add Desmos to your fork of Orpheus or for use in your own project, please visit www.desmos.com/my-api or reach out to the Desmos Studio team at partnerships@desmos.com
    "https://www.desmos.com/api/v1.11/calculator.js?apiKey=14470c380841448eae58c1b5f832477f",

    // Images
    "/images/192.png",
    "/images/512.png",
    "/images/favicon.ico",
    "/images/spartronics.jpg",

    // Scripts
    "/scripts/demo.js",
    "/scripts/script.js",
    "/scripts/uihandler.js",
    "/scripts/widget.js",

    // Styles
    "styles/comments.css",
    "styles/context_menu.css",
    "styles/global.css",
    "styles/graph.css",
    "styles/inputs.css",
    "styles/lists.css",
    "styles/main.css",
    "styles/match.css",
    "styles/overrides.css",
    "styles/table.css",
    "styles/team-info.css",
    "styles/themes.css",
    "styles/widgets.css",
]

self.addEventListener("install", (event) => {
    event.waitUntil(
        (async () => {
            const cache = await caches.open(CACHE_NAME)
            cache.addAll(APP_STATIC_RESOURCES)
        })(),
    )
})

// delete old caches on activate
self.addEventListener("activate", (event) => {
    event.waitUntil(
        (async () => {
            const names = await caches.keys()
            await Promise.all(
                names.map((name) => {
                    if (name !== CACHE_NAME) {
                        return caches.delete(name)
                    }
                    return undefined
                }),
            )
            await clients.claim()
        })(),
    )
})

// On fetch, intercept server requests
// and respond with cached responses instead of going to network
self.addEventListener("fetch", (event) => {
    // As a single page app, direct app to always go to cached home page.
    if (event.request.mode === "navigate") {
        event.respondWith(caches.match("/"))
        return
    }

    // For all other requests, go to the cache first, and then the network.
    event.respondWith(
        (async () => {
            const cache = await caches.open(CACHE_NAME)
            const cachedResponse = await cache.match(event.request.url)
            if (cachedResponse) {
                // Return the cached response if it's available.
                return cachedResponse
            }
            // If resource isn't in the cache, return a 404.
            return new Response(null, { status: 404 })
        })(),
    )
})