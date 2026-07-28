import Image from 'next/image';
import { Container } from '@/components/ui/Container';
import { createClient } from '@/lib/supabase/server';
import { getSiteImages } from '@/lib/site-images';
import { ProductAsset } from '@/lib/types';
import { generateMetadata as genMeta } from '@/lib/seo';
import { FileText, Download, Package } from 'lucide-react';

export const metadata = genMeta({
  title: 'Professional Resources',
  description: 'Access technical datasheets, catalogues, and photometric files for lighting professionals.',
  path: '/professionals',
});

export default async function ProfessionalsPage() {
  const supabase = await createClient();
  const siteImages = await getSiteImages();

  // Fetch general catalogues and documents (not linked to specific products)
  const { data: generalDocs } = supabase
    ? await supabase
        .from('product_assets')
        .select('*')
        .is('variant_id', null)
        .order('sort_order')
    : { data: null };

  // Group documents by type
  const catalogues = generalDocs?.filter(doc => doc.type === 'catalogue') || [];
  const otherDocs = generalDocs?.filter(doc => doc.type !== 'catalogue') || [];

  const getDocIcon = (type: string) => {
    switch (type) {
      case 'catalogue':
        return <Package className="w-6 h-6" />;
      case 'datasheet':
        return <FileText className="w-6 h-6" />;
      default:
        return <Download className="w-6 h-6" />;
    }
  };

  return (
    <div className="py-12 lg:py-16">
      {/* Hero */}
      <section className="relative h-[40vh] min-h-[300px] bg-gray-900 mb-16 flex items-center justify-center">
        {siteImages.professionals_hero?.image_url ? (
          <>
            <Image
              src={siteImages.professionals_hero.image_url}
              alt={siteImages.professionals_hero.alt_text || 'Professional Resources'}
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-black/50" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-gray-800" />
        )}
        <Container className="relative z-10 text-white">
          <h1 className="text-4xl lg:text-5xl font-light tracking-widest uppercase mb-4">
            Professional Resources
          </h1>
          <p className="text-lg font-light max-w-2xl leading-relaxed">
            Comprehensive technical documentation, catalogues, and support for architects,
            designers, and lighting specifiers.
          </p>
        </Container>
      </section>

      <Container>
        {/* Services */}
        <section className="mb-20">
          <h2 className="text-2xl font-light tracking-wide uppercase mb-8">
            Services for Professionals
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 border border-gray-200">
              <h3 className="text-lg font-medium uppercase tracking-wide mb-4">
                Technical Support
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Our technical team provides expert guidance on product specification, installation 
                requirements, and photometric data interpretation.
              </p>
            </div>
            <div className="p-8 border border-gray-200">
              <h3 className="text-lg font-medium uppercase tracking-wide mb-4">
                Project Consultation
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                We offer personalized consultation services to help specify the optimal lighting 
                solution for your project. Work with us and our authorized distributors to bring 
                your vision to life.
              </p>
            </div>
            <div className="p-8 border border-gray-200">
              <h3 className="text-lg font-medium uppercase tracking-wide mb-4">
                Custom Solutions
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                For unique requirements, we develop custom architectural lighting solutions — 
                minimal, discreet fixtures tailored to your project specifications and design intent.
              </p>
            </div>
          </div>
        </section>

        {/* Catalogues */}
        {catalogues.length > 0 && (
          <section className="mb-20">
            <h2 className="text-2xl font-light tracking-wide uppercase mb-8">
              Catalogues
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {catalogues.map((doc: ProductAsset) => (
                <a
                  key={doc.id}
                  href={doc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-4 p-6 border border-gray-200 hover:border-gray-900 transition-colors group"
                >
                  <div className="flex-shrink-0 text-gray-600 group-hover:text-gray-900">
                    {getDocIcon(doc.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium mb-1 group-hover:text-brand-copper transition-colors">
                      {doc.title}
                    </h3>
                    <p className="text-xs text-gray-500 uppercase">
                      {doc.file_extension} {doc.language && `• ${doc.language}`}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Other Documents */}
        {otherDocs.length > 0 && (
          <section className="mb-20">
            <h2 className="text-2xl font-light tracking-wide uppercase mb-8">
              Technical Documents
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {otherDocs.map((doc: ProductAsset) => (
                <a
                  key={doc.id}
                  href={doc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-4 p-6 border border-gray-200 hover:border-gray-900 transition-colors group"
                >
                  <div className="flex-shrink-0 text-gray-600 group-hover:text-gray-900">
                    {getDocIcon(doc.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium mb-1 group-hover:text-brand-copper transition-colors">
                      {doc.title}
                    </h3>
                    <p className="text-xs text-gray-500 uppercase">
                      {doc.file_extension} {doc.language && `• ${doc.language}`}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Empty State */}
        {catalogues.length === 0 && otherDocs.length === 0 && (
          <section className="text-center py-16 mb-20">
            <p className="text-gray-500 mb-8">
              General downloads will be available soon. Product-specific documentation can be 
              found on individual product pages.
            </p>
          </section>
        )}

        {/* Product Resources */}
        <section className="mb-20 py-12 bg-gray-50 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto text-center">
            <h2 className="text-2xl font-light tracking-wide uppercase mb-6">
              Product-Specific Resources
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto mb-8">
              Technical datasheets, photometric files (IES/LDT), installation manuals, and CAD 
              files are available on individual product pages.
            </p>
            <a
              href="/products"
              className="inline-flex items-center justify-center px-8 py-4 text-sm font-medium uppercase tracking-wide bg-gray-900 text-white hover:bg-gray-800 transition-colors"
            >
              Browse Products
            </a>
          </div>
        </section>

        {/* What We Provide */}
        <section className="mb-20">
          <h2 className="text-2xl font-light tracking-wide uppercase mb-8">
            What We Provide
          </h2>
          <div className="grid md:grid-cols-2 gap-x-16 gap-y-8">
            <div>
              <h3 className="text-lg font-medium uppercase tracking-wide mb-4">
                Technical Data
              </h3>
              <ul className="space-y-2 text-gray-600">
                <li>• Complete technical specifications</li>
                <li>• Photometric data (IES & LDT formats)</li>
                <li>• Electrical and mechanical specifications</li>
                <li>• Installation guidelines</li>
                <li>• Dimming compatibility information</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-medium uppercase tracking-wide mb-4">
                Design Files
              </h3>
              <ul className="space-y-2 text-gray-600">
                <li>• 2D CAD drawings</li>
                <li>• 3D models (where available)</li>
                <li>• Revit families (selected products)</li>
                <li>• Line drawings for documentation</li>
                <li>• High-resolution product images</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Contact CTA */}
        <section className="text-center py-12 border-t border-gray-200">
          <h2 className="text-3xl font-light tracking-wide uppercase mb-6">
            Need Additional Support?
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto mb-8">
            Our team is here to assist with technical questions, custom specifications, 
            and project consultation.
          </p>
          <a
            href="/contact"
            className="inline-flex items-center justify-center px-8 py-4 text-sm font-medium uppercase tracking-wide border border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white transition-colors"
          >
            Contact Technical Support
          </a>
        </section>
      </Container>
    </div>
  );
}

