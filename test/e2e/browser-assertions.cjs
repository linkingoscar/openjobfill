/** Poll resolved storage values. waitForFunction treats an async predicate's Promise
 * as truthy, so it is not a completion barrier for extension storage callbacks. */
exports.waitForCompletedRun = async (options, startedAt, pagePath, timeoutMs = 20000) => {
 const deadline=Date.now()+timeoutMs;
 while(Date.now()<deadline) {
  const sessions=await options.evaluate(async ({startedAt,pagePath})=>{
   const stored=(await chrome.storage.local.get('openjobfill_replay_snapshots')).openjobfill_replay_snapshots||[];
   return stored.filter(session=>session.createdAt>=startedAt && session.pageUrl.includes(pagePath) && session.summary && session.records.some(record=>record.stage==='execution-result'));
  },{startedAt,pagePath});
  if(sessions.length)return sessions.flatMap(session=>session.records.filter(record=>record.stage==='execution-result').map(record=>record.payload));
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 throw new Error(`Current fill did not complete: ${pagePath}`);
};
