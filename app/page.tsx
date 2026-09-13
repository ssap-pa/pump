import Desk from './desk';
import {requireChatGPTUser} from './chatgpt-auth';
export default async function Page(){const user=await requireChatGPTUser('/');return <Desk draftOwner={user.userId}/>;}
