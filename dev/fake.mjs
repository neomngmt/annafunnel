// In-memory stand-ins for Supabase and Claude, shared by the tests and dev server.

export const TEST_PAGE = {
  slug: "test",
  name: "Testovací modelka",
  language: "cs",
  opener: "Čau, co tě sem přivedlo?",
  photoUrl: null,
  teasePhotos: [],
  persona: "",
  style: "",
  offer: "",
  ofLinks: { default: "https://onlyfans.com/test", ig: "https://onlyfans.com/test/ig" },
};

export function fakeDeps(callModel, page = TEST_PAGE) {
  const sessions = new Map();
  const created = [];
  return {
    sessions,
    ipSalt: "test",
    getPage: async (slug) => (page && slug === page.slug ? page : null),
    countSessions: async (since, ipHash) =>
      created.filter((s) => s.at >= since && (!ipHash || s.ipHash === ipHash)).length,
    createSession: async (s) => {
      sessions.set(s.id, { ...s });
      created.push({ at: new Date(), ipHash: s.ipHash });
    },
    getSession: async (id) => sessions.get(id) || null,
    updateSession: async (id, patch) => {
      Object.assign(sessions.get(id), patch);
    },
    callModel,
  };
}
