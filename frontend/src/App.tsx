import PlaidLinkButton from "./Components/Link"
import UserAccounts from "./Components/UserAccounts"

function App() {
  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen gap-4">
      <UserAccounts />
      <PlaidLinkButton />
    </div>
  )
}

export default App
