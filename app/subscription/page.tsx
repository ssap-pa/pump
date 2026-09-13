import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { SubscriptionScreen } from './screen';
export default async function SubscriptionPage(){await requireChatGPTUser('/subscription');return <SubscriptionScreen/>;}
