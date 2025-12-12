// Convertisseur de nombres en lettres (français)

const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

function convertLessThanHundred(n: number): string {
  if (n < 20) return units[n];
  
  const ten = Math.floor(n / 10);
  const unit = n % 10;
  
  if (ten === 7 || ten === 9) {
    // 70-79 et 90-99 (base 60 et 80)
    const base = ten === 7 ? 60 : 80;
    const remainder = n - base;
    if (ten === 7) {
      return 'soixante' + (remainder === 0 ? '-dix' : remainder < 10 ? '-' + units[10 + remainder] : '-' + units[remainder]);
    } else {
      if (remainder === 0) return 'quatre-vingts';
      return 'quatre-vingt-' + (remainder < 20 ? units[remainder] : convertLessThanHundred(remainder));
    }
  }
  
  if (unit === 0) {
    return ten === 8 ? 'quatre-vingts' : tens[ten];
  }
  
  if (unit === 1 && ten !== 8) {
    return tens[ten] + ' et un';
  }
  
  return tens[ten] + '-' + units[unit];
}

function convertLessThanThousand(n: number): string {
  if (n < 100) return convertLessThanHundred(n);
  
  const hundred = Math.floor(n / 100);
  const remainder = n % 100;
  
  let result = '';
  if (hundred === 1) {
    result = 'cent';
  } else {
    result = units[hundred] + ' cent';
  }
  
  if (remainder === 0) {
    return hundred > 1 ? result + 's' : result;
  }
  
  return result + ' ' + convertLessThanHundred(remainder);
}

function convertNumber(n: number): string {
  if (n === 0) return 'zéro';
  if (n < 0) return 'moins ' + convertNumber(-n);
  
  const billion = Math.floor(n / 1000000000);
  const million = Math.floor((n % 1000000000) / 1000000);
  const thousand = Math.floor((n % 1000000) / 1000);
  const remainder = n % 1000;
  
  let result = '';
  
  if (billion > 0) {
    result += convertLessThanThousand(billion) + ' milliard' + (billion > 1 ? 's' : '') + ' ';
  }
  
  if (million > 0) {
    result += convertLessThanThousand(million) + ' million' + (million > 1 ? 's' : '') + ' ';
  }
  
  if (thousand > 0) {
    if (thousand === 1) {
      result += 'mille ';
    } else {
      result += convertLessThanThousand(thousand) + ' mille ';
    }
  }
  
  if (remainder > 0) {
    result += convertLessThanThousand(remainder);
  }
  
  return result.trim();
}

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  namePlural: string;
  centName: string;
  centNamePlural: string;
}

export const currencies: Record<string, CurrencyInfo> = {
  TND: {
    code: 'TND',
    name: 'dinar',
    symbol: 'DT',
    namePlural: 'dinars',
    centName: 'millime',
    centNamePlural: 'millimes',
  },
  EUR: {
    code: 'EUR',
    name: 'euro',
    symbol: '€',
    namePlural: 'euros',
    centName: 'centime',
    centNamePlural: 'centimes',
  },
  USD: {
    code: 'USD',
    name: 'dollar',
    symbol: '$',
    namePlural: 'dollars',
    centName: 'cent',
    centNamePlural: 'cents',
  },
};

export function numberToWords(amount: number, currencyCode: string = 'TND'): string {
  const currency = currencies[currencyCode] || currencies.TND;
  
  const integerPart = Math.floor(amount);
  const decimalPart = Math.round((amount - integerPart) * 1000); // Millimes pour TND (3 décimales)
  
  // Pour EUR et USD, on utilise 2 décimales (centimes)
  const actualDecimal = currencyCode === 'TND' 
    ? Math.round((amount - integerPart) * 1000)
    : Math.round((amount - integerPart) * 100);
  
  let result = '';
  
  // Partie entière
  if (integerPart === 0 && actualDecimal === 0) {
    result = 'zéro ' + currency.name;
  } else if (integerPart === 0) {
    result = '';
  } else if (integerPart === 1) {
    result = 'un ' + currency.name;
  } else {
    result = convertNumber(integerPart) + ' ' + currency.namePlural;
  }
  
  // Partie décimale
  if (actualDecimal > 0) {
    if (result) result += ' et ';
    if (actualDecimal === 1) {
      result += 'un ' + currency.centName;
    } else {
      result += convertNumber(actualDecimal) + ' ' + currency.centNamePlural;
    }
  }
  
  // Capitaliser la première lettre
  return result.charAt(0).toUpperCase() + result.slice(1);
}

export function formatCurrency(amount: number, currencyCode: string = 'TND'): string {
  const currency = currencies[currencyCode];
  if (!currency) return `${amount.toFixed(2)} ${currencyCode}`;
  
  const decimals = currencyCode === 'TND' ? 3 : 2;
  
  // Formatage selon la locale
  const formatted = new Intl.NumberFormat('fr-TN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
  
  return `${formatted} ${currency.symbol}`;
}
