import RecordConversionPage from '@/components/RecordConversionPage';

export default async function ConvertPage({params}: {params: Promise<{id: string}>}) {
    const {id} = await params;
    return <RecordConversionPage kind="incomes" id={Number(id)}/>;
}
