// A single conditional INSERT keeps the quota atomic, including concurrent requests.
export const FREE_SITE_LIMIT = 10;
export const INSERT_SITE_SQL = `INSERT INTO records(id,owner,kind,parent,data,created)
SELECT ?,?,'site','',?,?
WHERE (SELECT COUNT(*) FROM records WHERE owner=? AND kind='site') < ?
OR EXISTS (SELECT 1 FROM subscriptions WHERE owner=?
 AND json_extract(data,'$.status') IN ('active','canceled','past_due')
 AND CAST(json_extract(data,'$.periodEnd') AS INTEGER) > ?)`;
export async function insertSite(database:D1Database,owner:string,id:string,data:unknown){
 const now=Date.now();
 const result=await database.prepare(INSERT_SITE_SQL).bind(id,owner,JSON.stringify(data),new Date(now).toISOString(),owner,FREE_SITE_LIMIT,owner,now).run();
 return Number(result.meta.changes)>0;
}
