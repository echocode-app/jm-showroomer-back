// Config: logger setup.

export const log = {
    info: (msg) => console.log(`ℹ️ ${msg}`),
    success: (msg) => console.log(`✅ ${msg}`),
    error: (msg) => console.log(`🔺 ${msg}`),
    fatal: (msg) => console.log(`❌ ${msg}`)
};
