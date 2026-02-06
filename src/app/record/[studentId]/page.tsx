import RecordClient from './RecordClient';

export const dynamicParams = false;
export const dynamic = 'force-static';

export function generateStaticParams() {
    return [{ studentId: '1' }];
}

export default function RecordPage() {
    return <RecordClient />;
}
