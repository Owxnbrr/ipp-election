import { getProductsConfig } from '@/lib/pricing';
import OrderForm from '@/components/OrderForm';

export default async function CommandePage() {
  const productsConfig = await getProductsConfig();

  return (
    <div className="py-12">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Passer une commande</h1>
          <p className="text-gray-600">
            Suivez les étapes pour configurer votre commande de documents électoraux
          </p>
        </div>

        <OrderForm productsConfig={productsConfig} />
      </div>
    </div>
  );
}
