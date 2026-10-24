// The income screen remembers what the person was looking at while the app
// stays open. That memory belongs to the signed-in account: a different
// account (or none) never inherits the period, currency or search of another.
// `store` is the remembered object ({ uid, period, ... }) or null.
export function rememberedFor(store, uid) {
  if (!store || store.uid !== uid) return null
  return store
}
