import { latestReleaseApi } from "./site.ts"

export interface Release {
  /** "1.0.0", from the tag "v1.0.0". The release assets are named after it. */
  version: string
  url: string
  published: Date
}

/**
 * The latest Windows release, fetched once per build for every page that
 * shows it. Null when the build is offline or GitHub's API refuses it, so a
 * page has to read without one.
 */
export const latestRelease: Promise<Release | null> = fetch(latestReleaseApi, {
  headers: { Accept: "application/vnd.github+json" },
})
  .then((res) => (res.ok ? res.json() : null))
  .then(
    (r: { tag_name: string; html_url: string; published_at: string } | null) =>
      r
        ? {
            version: r.tag_name.replace(/^v/, ""),
            url: r.html_url,
            published: new Date(r.published_at),
          }
        : null
  )
  .catch(() => null)
