export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow p-6 space-y-3 text-gray-900">
        <h1 className="text-2xl font-bold">Privacy Policy</h1>
        <p>We collect: your name, phone, email, live location while you use the app, and for drivers, ID and licence documents.</p>
        <p>We use it to match drivers and customers, process payments, verify drivers, and keep users safe.</p>
        <p>Driver documents are stored privately and seen only by our verification team.</p>
        <p>We share your phone number and location with your matched driver or customer for the job only.</p>
        <p>You can ask us to access or delete your data at: your-support@email.com.</p>
        <p className="text-sm text-gray-700">Replace this text with lawyer-approved wording before launch.</p>
      </div>
    </main>
  );
}