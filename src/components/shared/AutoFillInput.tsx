import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/lib/utils';
import type { AutoFillAdapter, AutoFillEntityKey, AutoFillMode } from './autoFillAdapters';
import { getDefaultAutoFillAdapter, isDuplicateName } from './autoFillAdapters';

type AutoFillInputProps<T> = {
  entity?: AutoFillEntityKey;
  adapter?: AutoFillAdapter<T>;
  mode?: AutoFillMode;

  label?: string;
  placeholder?: string;
  disabled?: boolean;

  selectedId?: string;
  value?: T | null;
  onSelect: (item: T) => void;

  allowCreate?: boolean;

  textValue?: string;
  onTextValueChange?: (text: string) => void;

  // Optional: when selecting/creating an item in `mode="input"`, you can decide what
  // text should be pushed into the input. If omitted, AutoFillInput will not
  // mutate the text value on select (caller controls it).
  setTextOnSelect?: (item: T) => string;

  debounceMs?: number;
  minQueryLength?: number;
  limit?: number;
};

export function AutoFillInput<T>(props: AutoFillInputProps<T>) {
  const {
    entity,
    adapter: adapterProp,
    mode = 'combobox',
    label,
    placeholder,
    disabled,
    selectedId,
    value,
    onSelect,
    allowCreate = true,
    textValue,
    onTextValueChange,
    setTextOnSelect,
    debounceMs = 250,
    minQueryLength = 0,
    limit = 25,
  } = props;

  const { toast } = useToast();
  const { activeCompanyId, user } = useAuth();

  const adapter = useMemo<AutoFillAdapter<T>>(() => {
    if (adapterProp) return adapterProp;
    if (!entity) throw new Error('AutoFillInput: provide either `entity` or `adapter`');
    return getDefaultAutoFillAdapter(entity) as AutoFillAdapter<T>;
  }, [adapterProp, entity]);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, debounceMs);

  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const [resolvedSelected, setResolvedSelected] = useState<T | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  const lastFetchId = useRef(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  const selectedLabel = useMemo(() => {
    if (value) return adapter.getLabel(value);
    if (resolvedSelected) return adapter.getLabel(resolvedSelected);
    return '';
  }, [adapter, resolvedSelected, value]);

  const displayPlaceholder = placeholder ?? (() => {
    switch (adapter.entity) {
      case 'client':
        return 'Sélectionner un client...';
      case 'supplier':
        return 'Sélectionner un fournisseur...';
      case 'product':
      default:
        return 'Sélectionner...';
    }
  })();

  const effectiveTextValue = textValue ?? (mode === 'input' ? query : '');

  // Keep internal query in sync with a controlled textValue.
  useEffect(() => {
    if (mode !== 'input') return;
    if (typeof textValue !== 'string') return;
    setQuery(textValue);
  }, [mode, textValue]);

  // Resolve selected label by id for combobox trigger.
  useEffect(() => {
    if (!activeCompanyId) return;
    if (value) {
      setResolvedSelected(value);
      return;
    }
    if (!selectedId) {
      setResolvedSelected(null);
      return;
    }
    if (!adapter.getById) {
      setResolvedSelected(null);
      return;
    }

    let cancelled = false;
    adapter
      .getById({ companyId: activeCompanyId, id: selectedId })
      .then((item) => {
        if (cancelled) return;
        setResolvedSelected(item);
      })
      .catch(() => {
        if (cancelled) return;
        setResolvedSelected(null);
      });

    return () => {
      cancelled = true;
    };
  }, [activeCompanyId, adapter, selectedId, value]);

  const canSearch = Boolean(activeCompanyId) && debouncedQuery.trim().length >= minQueryLength;

  const createCandidate = useMemo(() => {
    const typed = (mode === 'input' ? effectiveTextValue : query).trim();
    if (!allowCreate) return null;
    if (!typed) return null;

    const hasExact = results.some((r) => isDuplicateName(String(adapter.getLabel(r) ?? ''), typed));
    if (hasExact) return null;

    return typed;
  }, [adapter, allowCreate, effectiveTextValue, mode, query, results]);

  useEffect(() => {
    if (!open) return;
    if (!activeCompanyId) return;
    if (!canSearch) {
      setResults([]);
      setLoading(false);
      return;
    }

    const fetchId = ++lastFetchId.current;
    setLoading(true);

    adapter
      .search({ companyId: activeCompanyId, query: debouncedQuery, limit })
      .then((data) => {
        if (fetchId !== lastFetchId.current) return;
        setResults(data);
        setActiveIndex(data.length > 0 ? 0 : -1);
      })
      .catch((e: any) => {
        if (fetchId !== lastFetchId.current) return;
        toast({ variant: 'destructive', title: 'Erreur', description: e?.message || 'Erreur de recherche' });
        setResults([]);
        setActiveIndex(-1);
      })
      .finally(() => {
        if (fetchId !== lastFetchId.current) return;
        setLoading(false);
      });
  }, [activeCompanyId, adapter, canSearch, debouncedQuery, limit, open, toast]);

  const handleSelect = (item: T) => {
    onSelect(item);
    setResolvedSelected(item);
    setOpen(false);
    setActiveIndex(-1);

    if (mode === 'input' && onTextValueChange && setTextOnSelect) {
      onTextValueChange(setTextOnSelect(item));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const max = results.length + (createCandidate ? 1 : 0) - 1;
      if (max < 0) return;
      setActiveIndex((idx) => (idx >= max ? 0 : idx + 1));
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const max = results.length + (createCandidate ? 1 : 0) - 1;
      if (max < 0) return;
      setActiveIndex((idx) => (idx <= 0 ? max : idx - 1));
    }

    if (e.key === 'Enter') {
      const createIndex = results.length;
      if (createCandidate && activeIndex === createIndex) {
        e.preventDefault();
        setCreateName(createCandidate);
        setCreateOpen(true);
        return;
      }

      const item = results[activeIndex];
      if (item) {
        e.preventDefault();
        handleSelect(item);
      }
    }

    if (e.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  const openCreate = (name: string) => {
    setCreateName(name);
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    const companyId = activeCompanyId;
    const userId = user?.id;
    const name = createName.trim();

    if (!companyId || !userId) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Session invalide (company/user).' });
      return;
    }
    if (!name) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Nom requis.' });
      return;
    }

    try {
      setCreateLoading(true);
      const created = await adapter.create({ companyId, userId, name });
      onSelect(created);
      setResolvedSelected(created);
      setCreateOpen(false);
      setOpen(false);
      setQuery('');
      setResults([]);
      toast({ title: 'Succès', description: 'Créé et sélectionné.' });

      if (mode === 'input' && onTextValueChange && setTextOnSelect) {
        onTextValueChange(setTextOnSelect(created));
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: e?.message || 'Création impossible' });
    } finally {
      setCreateLoading(false);
    }
  };

  const renderOption = (item: T, index: number) => {
    const id = adapter.getId(item);
    const isSelected = (value && adapter.getId(value) === id) || (resolvedSelected && adapter.getId(resolvedSelected) === id) || selectedId === id;
    const sub = adapter.getSubLabel?.(item);
    const disabledOption = adapter.isOptionDisabled?.(item) ?? false;

    return (
      <button
        key={id}
        type="button"
        disabled={disabledOption}
        className={cn(
          'w-full text-left rounded-md px-2 py-2 hover:bg-accent focus:bg-accent focus:outline-none',
          disabledOption && 'opacity-50 cursor-not-allowed hover:bg-transparent focus:bg-transparent',
          index === activeIndex && 'bg-accent'
        )}
        onMouseDown={(e) => e.preventDefault()}
        onMouseEnter={() => setActiveIndex(index)}
        onClick={() => {
          if (disabledOption) return;
          handleSelect(item);
        }}
      >
        <div className="flex items-start gap-2">
          <Check className={cn('mt-0.5 h-4 w-4 shrink-0', isSelected ? 'opacity-100' : 'opacity-0')} />
          <div className="flex-1">
            <div className="flex justify-between gap-3">
              <span className="font-medium truncate">{adapter.getLabel(item)}</span>
            </div>
            {sub ? <div className="text-xs text-muted-foreground truncate">{sub}</div> : null}
          </div>
        </div>
      </button>
    );
  };

  const dropdown = (
    <div ref={listRef} className="max-h-[320px] overflow-auto p-1">
      {loading ? (
        <div className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement...
        </div>
      ) : results.length === 0 ? (
        <div className="px-3 py-2 text-sm text-muted-foreground">Aucun résultat.</div>
      ) : (
        <div className="space-y-0.5">{results.map((item, idx) => renderOption(item, idx))}</div>
      )}

      {createCandidate ? (
        <div className="mt-1 border-t pt-1">
          <button
            type="button"
            className={cn(
              'w-full text-left rounded-md px-2 py-2 hover:bg-accent focus:bg-accent focus:outline-none',
              activeIndex === results.length && 'bg-accent'
            )}
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => setActiveIndex(results.length)}
            onClick={() => openCreate(createCandidate)}
          >
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span>Créer “{createCandidate}”</span>
            </div>
          </button>
        </div>
      ) : null}
    </div>
  );

  const triggerInput = (
    <Input
      value={effectiveTextValue}
      placeholder={displayPlaceholder}
      disabled={disabled}
      onFocus={() => setOpen(true)}
      onKeyDown={handleKeyDown}
      onChange={(e) => {
        const v = e.target.value;
        if (onTextValueChange) onTextValueChange(v);
        setQuery(v);
        setOpen(true);
      }}
    />
  );

  const triggerCombobox = (
    <Button
      variant="outline"
      role="combobox"
      aria-expanded={open}
      disabled={disabled}
      className="w-full justify-between text-left"
      onClick={() => {
        if (disabled) return;
        setOpen((v) => !v);
        if (!open) {
          setQuery('');
          setResults([]);
          setActiveIndex(-1);
        }
      }}
    >
      <span className="truncate">{selectedLabel || displayPlaceholder}</span>
      {loading ? <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-70" /> : <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
    </Button>
  );

  return (
    <div className="space-y-2">
      {label ? <Label>{label}</Label> : null}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {mode === 'input' ? triggerInput : triggerCombobox}
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          {mode === 'combobox' ? (
            <div className="p-2 border-b">
              <Input
                value={query}
                placeholder="Rechercher..."
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
                }}
                onKeyDown={handleKeyDown}
                autoFocus
              />
            </div>
          ) : null}
          {dropdown}
        </PopoverContent>
      </Popover>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <Label>Nom *</Label>
            <Input value={createName} onChange={(e) => setCreateName(e.target.value)} autoFocus />
          </div>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setCreateOpen(false)} disabled={createLoading}>
              Annuler
            </Button>
            <Button type="button" onClick={submitCreate} disabled={createLoading}>
              {createLoading ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
