import Desk from './desk';
import {getChatGPTUser} from './chatgpt-auth';
export default async function Page(){const user=await getChatGPTUser();return <Desk draftOwner={user?.userId ?? null}/>;}
