import PlaidLinkButton from '../Components/Link'
import UserAccounts from '../Components/UserAccounts'

export default function Connect() {
    return (
        <div className="flex flex-col items-center justify-center h-screen">
            <PlaidLinkButton />
            <UserAccounts />
        </div>
    )
}