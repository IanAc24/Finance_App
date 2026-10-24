// Ids for records saved in the cloud. There is no database counter there, and
// two devices of the same person can add records at the same time (even
// without internet), so each id is made on the device: the moment in
// milliseconds times 1000 plus a random 0-999. They grow with time, so
// "newest first" still breaks ties by id, and two devices would need the
// same millisecond and the same random number to clash.
// They stay far below Number.MAX_SAFE_INTEGER (and MAX_ID in backup.js)
// until well past the year 2100.

let lastId = 0

export function newId(now = Date.now(), random = Math.random) {
  let id = Math.floor(now) * 1000 + Math.floor(random() * 1000)
  // never repeat or go back on this device, even if the clock does
  if (id <= lastId) id = lastId + 1
  lastId = id
  return id
}
