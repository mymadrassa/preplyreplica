/** @type {import('next').NextConfig} */
module.exports = {
  transpilePackages: ['@preply-clone/mushaf'],
  experimental: {
    // Keep pages the browser has already loaded for a short while, so going
    // back to one is instant instead of another round of database calls.
    // `static` also covers pages the sidebar preloads in the background, so
    // it's kept short: that's how old their data can be when you open them.
    // Actions that change data call router.refresh(), which bypasses this.
    staleTimes: {
      dynamic: 30,
      static: 60,
    },
  },
}
