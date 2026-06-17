import CompanionPage from "./_component";

export default function Companion() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex bg-gray-50 dark:bg-gray-900">
        <div className="flex-1 md:ml-64 bg-gray-50 dark:bg-gray-900">
          <CompanionPage />
        </div>
      </div>
    </div>
  );
}
