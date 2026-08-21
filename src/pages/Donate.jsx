import MainLayout from '../layouts/MainLayout';

export default function Donate() {
  return (
    <MainLayout>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
        <div className="flex flex-col gap-8 lg:col-span-12">
          <div className="space-y-4 text-center lg:text-left">
            <h1 className="text-4xl font-serif font-black leading-tight tracking-tight text-text-main sm:text-5xl lg:text-6xl">
              Driving Change Through <span className="italic text-trophy-gold">Golf</span>.
            </h1>
            <p className="max-w-2xl text-lg leading-relaxed text-gray-500">
              The society supports charitable causes through its golf events. An approved online donation provider has not yet been confirmed.
            </p>
          </div>

          <div className="mx-auto max-w-xl overflow-hidden rounded-xl border border-gray-200 bg-white p-8 shadow-sm lg:mx-0">
            <h2 className="mb-4 text-2xl font-serif font-bold text-midnight-navy">Online donations unavailable</h2>
            <p className="leading-7 text-gray-600" role="status">
              No payment or donation link is currently published. Please speak to a committee member through your usual society contact before sending funds. The website will show a provider only after it has been verified.
            </p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
