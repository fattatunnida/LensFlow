import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../auth/AuthProvider';
import { getFirebaseClient } from '../../lib/firebase/client';
import { canRead, masterErrorMessage, type MasterActor, type MasterKind, type MasterRecords, type PackageFilter } from './models';
import { readMaster, readMasterPage, type MasterPage } from './repository';

export function useMasterActor(): MasterActor | null {
  const { state } = useAuth();
  const session = state.status === 'authenticated' ? state.session : null;
  const uid = session?.uid, studioId = session?.studioId, role = session?.role;
  const crm = session?.permissions.calendarCrm ?? false, booking = session?.permissions.booking ?? false;
  const payments=session?.permissions.payments??false,reports=session?.permissions.reports??false;
  return useMemo(() => uid && studioId && role ? { uid, studioId, role, crm, booking, payments, reports } : null, [uid, studioId, role, crm, booking, payments, reports]);
}

function useDebounced(value: string): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => { const timer = setTimeout(() => setDebounced(value), 250); return () => clearTimeout(timer); }, [value]);
  return debounced;
}

type PageState<T> = MasterPage<T> & { key: string; status: 'loading' | 'ready' | 'error'; error: string; loadingMore: boolean; moreError: string };
function emptyPage<T>(key: string): PageState<T> { return { key, items: [], cursor: null, hasMore: false, status: 'loading', error: '', loadingMore: false, moreError: '' }; }

export function useMasterList<K extends MasterKind>(kind: K, search: string, filter: PackageFilter = 'all') {
  const actor = useMasterActor();
  const [db] = useState(() => getFirebaseClient().db);
  const term = useDebounced(search);
  const allowed = canRead(actor, kind);
  const effectiveFilter = actor?.role === 'staff' && kind === 'packages' ? 'active' : filter;
  const key = JSON.stringify([actor, kind, term.trim(), effectiveFilter]);
  const [result, setResult] = useState<PageState<MasterRecords[K]>>(() => emptyPage(''));
  const generation = useRef(0), moreBusy = useRef(false);

  const reload = useCallback(() => {
    const request = ++generation.current;
    moreBusy.current = false;
    if (!actor || !allowed) return;
    setResult(emptyPage(key));
    void readMasterPage(db, actor, kind, term, effectiveFilter).then((page) => {
      if (generation.current === request) setResult({ ...page, key, status: 'ready', error: '', loadingMore: false, moreError: '' });
    }, (error: unknown) => {
      if (generation.current === request) setResult({ ...emptyPage<MasterRecords[K]>(key), status: 'error', error: masterErrorMessage(error) });
    });
  }, [actor, allowed, db, kind, term, effectiveFilter, key]);

  useFocusEffect(useCallback(() => { reload(); return () => { ++generation.current; moreBusy.current = false; }; }, [reload]));

  const loadMore = useCallback(() => {
    if (!actor || !allowed || moreBusy.current || result.key !== key || result.status !== 'ready' || !result.hasMore || !result.cursor) return;
    moreBusy.current = true;
    const request = generation.current;
    setResult((old) => ({ ...old, loadingMore: true, moreError: '' }));
    void readMasterPage(db, actor, kind, term, effectiveFilter, result.cursor).then((page) => {
      if (request !== generation.current) return;
      setResult((old) => ({ ...old, ...page, items: [...old.items, ...page.items.filter((item) => !old.items.some((previous) => previous.id === item.id))], loadingMore: false, moreError: '' }));
    }, (error: unknown) => {
      if (request === generation.current) setResult((old) => ({ ...old, loadingMore: false, moreError: masterErrorMessage(error) }));
    }).finally(() => { if (request === generation.current) moreBusy.current = false; });
  }, [actor, allowed, db, kind, term, effectiveFilter, key, result]);

  return { ...(result.key === key ? result : emptyPage<MasterRecords[K]>(key)), actor, allowed, reload, loadMore, searching: term !== search };
}

type DocumentState<T> = { key: string; status: 'loading' | 'ready' | 'error'; record: T | null; error: string };
export function useMasterDocument<K extends MasterKind>(kind: K, id?: string) {
  const actor = useMasterActor();
  const [db] = useState(() => getFirebaseClient().db);
  const allowed = canRead(actor, kind);
  const key = JSON.stringify([actor, kind, id]);
  const [result, setResult] = useState<DocumentState<MasterRecords[K]>>({ key: '', status: 'loading', record: null, error: '' });
  const generation = useRef(0);
  const reload = useCallback(() => {
    const request = ++generation.current;
    if (!id || !actor || !allowed) return;
    setResult({ key, status: 'loading', record: null, error: '' });
    void readMaster(db, actor, kind, id).then((record) => {
      if (generation.current === request) setResult({ key, status: 'ready', record, error: '' });
    }, (error: unknown) => {
      if (generation.current === request) setResult({ key, status: 'error', record: null, error: masterErrorMessage(error) });
    });
  }, [actor, allowed, db, id, key, kind]);
  useFocusEffect(useCallback(() => { reload(); return () => { ++generation.current; }; }, [reload]));
  const current = !id ? { key, status: 'ready' as const, record: null, error: '' } : result.key === key ? result : { key, status: 'loading' as const, record: null, error: '' };
  return { ...current, actor, allowed, reload, db };
}
