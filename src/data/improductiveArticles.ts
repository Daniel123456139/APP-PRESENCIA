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
    { id: 'IMPR UTILLAJE', desc: 'IMPRODUCTIVO DE UTILLAJE' }
];

export const normalizeArticleId = (value?: string | null): string => {
    if (!value) return '';
    return value
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
};

const normalizeToken = (value?: string | null): string => {
    if (!value) return '';
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
};

export const IMPRODUCTIVE_ARTICLE_LOOKUP = new Map(
    IMPRODUCTIVE_ARTICLES.map((item) => [normalizeArticleId(item.id), item])
);

const IMPRODUCTIVE_ARTICLE_LOOKUP_BY_ID_TOKEN = new Map(
    IMPRODUCTIVE_ARTICLES.map((item) => [normalizeToken(item.id), item])
);

const IMPRODUCTIVE_ARTICLE_LOOKUP_BY_DESC = new Map(
    IMPRODUCTIVE_ARTICLES.map((item) => [normalizeToken(item.desc), item])
);

export const getImproductiveArticle = (articleId?: string | null, articleDesc?: string | null): ImproductiveArticle | undefined => {
    const key = normalizeArticleId(articleId);
    if (key) {
        const exact = IMPRODUCTIVE_ARTICLE_LOOKUP.get(key);
        if (exact) return exact;

        const tokenMatch = IMPRODUCTIVE_ARTICLE_LOOKUP_BY_ID_TOKEN.get(normalizeToken(key));
        if (tokenMatch) return tokenMatch;
    }

    const descToken = normalizeToken(articleDesc);
    if (descToken) {
        return IMPRODUCTIVE_ARTICLE_LOOKUP_BY_DESC.get(descToken);
    }

    return undefined;
};
