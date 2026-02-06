import ParentPortalClient from './ParentPortalClient';

export const dynamicParams = false;
export const dynamic = 'force-static';

export function generateStaticParams() {
    return [{ studentID: '1' }];
}

export default function ParentPortalPage() {
    return <ParentPortalClient />;
}
