import MeetingClient from './MeetingClient';

export const dynamicParams = false;
export const dynamic = 'force-static';

export function generateStaticParams() {
    return [{ id: '1' }];
}

export default function MeetingPage() {
    return <MeetingClient />;
}
