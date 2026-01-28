export interface ImproductiveArticle {
    id: string;
    desc: string;
}

export const IMPRODUCTIVE_ARTICLES: ImproductiveArticle[] = [
    { id: 'IMPR CALIDAD', desc: 'IMPRODUCTIVO DE CALIDAD' },
    { id: 'IMPR CAMION', desc: 'IMPRODUCTIVO DE CAMION' },
    { id: 'IMPR CARRO CADE', desc: 'IMPRODUCTIVO DE CARRO CADE' },
    { id: 'IMPR DESPRENDER', desc: 'IMPRODUCTIVO DE DESPRENDER' },
    { id: 'IMPR EMBALAJE', desc: 'IMPRODUCTIVO DE EMBALAJE' },
    { id: 'IMPR EN ESPERA', desc: 'IMPRODUCTIVO DE EN ESPERA' },
    { id: 'IMPR FORMACION', desc: 'IMPRODUCTIVO FORMACION' },
    { id: 'IMPR LIMPIEZA', desc: 'IMPRODUCTIVO DE LIMPIEZA' },
    { id: 'IMPR MANTENIMIENTO', desc: 'IMPRODUCTIVO DE MANTENIMIENTO' },
    { id: 'IMPR OFERTAS', desc: 'IMPRODUCTIVO DE OFERTAS' },
    { id: 'IMPR ORGANIZACION', desc: 'IMPRODUCTIVO DE ORGANIZACION' },
    { id: 'IMPR PROGRAMACION', desc: 'IMPRODUCTIVO DE PROGRAMACION' },
    { id: 'IMPR PROGRAMACION CORTE', desc: 'IMPRODUCTIVO DE PROGRAMACION CORTE' },
    { id: 'IMPR PROVIS', desc: 'IMPRODUCTIVO DE PROVIS' },
    { id: 'IMPR REPINTAR', desc: 'IMPRODUCTIVO DE REPINTAR' },
    { id: 'IMPR REUNIONES', desc: 'IMPRODUCTIVO DE REUNIONES' },
    { id: 'IMPR TRANSPORTE', desc: 'IMPRODUCTIVO DE TRANSPORTE' },
    { id: 'IMPR UTILLAJE', desc: 'IMPRODUCTIVO DE UTILLAJE' },
    { id: 'IMPROD.ALMACEN', desc: 'TIEMPOS NO PRODUCTIVOS DE ALMACEN' },
    { id: 'IMPROD.CALIDAD', desc: 'TIEMPOS NO PRODUCTIVOS DE CALIDAD' },
    { id: 'IMPRODUCTIVO 11', desc: 'TIEMPO NO PRODUCTIVO' },
    { id: 'IMPRODUCTIVO 12', desc: 'TIEMPO NO PRODUCTIVO REPASADO BOMBO' },
    { id: 'IMPRODUCTIVOS', desc: 'TIEMPOS NO PRODUCTIVOS' },
    { id: 'IMPRODUCTVOS 2', desc: 'REPROCESOS INTERNOS GENERALES ((JULIO-2006))' }
];

export const normalizeArticleId = (value?: string | null): string => {
    if (!value) return '';
    return value.trim().toUpperCase();
};

export const IMPRODUCTIVE_ARTICLE_LOOKUP = new Map(
    IMPRODUCTIVE_ARTICLES.map((item) => [normalizeArticleId(item.id), item])
);

export const getImproductiveArticle = (articleId?: string | null): ImproductiveArticle | undefined => {
    const key = normalizeArticleId(articleId);
    if (!key) return undefined;
    return IMPRODUCTIVE_ARTICLE_LOOKUP.get(key);
};
