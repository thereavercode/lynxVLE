import { getSupabase, supabase } from '$lib/utils/functions/supabase';
import type { CurrentOrg } from '$lib/utils/types/org';
import type { MetaTagsProps } from 'svelte-meta-tags';

import { PUBLIC_IS_SELFHOSTED } from '$env/static/public';
import { blockedSubdomain } from '$lib/utils/constants/app';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { getCurrentOrg } from '$lib/utils/services/org';
import { redirect } from '@sveltejs/kit';

if (!supabase) getSupabase();

export const ssr = PUBLIC_IS_SELFHOSTED !== 'true';

interface LoadOutput {
  orgSiteName: string;
  isOrgSite: boolean;
  skipAuth: boolean;
  org: CurrentOrg | null;
  baseMetaTags: MetaTagsProps;
  serverLang: string;
}

const APP_SUBDOMAINS =
  env.PRIVATE_APP_SUBDOMAINS?.split(',').map((s) => s.trim()) ?? [];

export const load = async ({ url, cookies, request }): Promise<LoadOutput> => {
  const origin = url.origin;
  const host = url.host;

  const isLocal = host.includes('localhost');
  const isVercel = host.endsWith('vercel.app');
  const isDevEnv = dev || isLocal || isVercel;

  const response: LoadOutput = {
    orgSiteName: '',
    isOrgSite: false,
    skipAuth: false,
    org: null,
    baseMetaTags: getBaseMetaTags(url),
    serverLang: request.headers?.get('accept-language') ?? ''
  };

  /* -------------------------------------------------------------------------- */
  /* SELF-HOSTED MODE                                                           */
  /* -------------------------------------------------------------------------- */

  if (PUBLIC_IS_SELFHOSTED === 'true') {
    const subdomain = getSubdomain(url);
    if (!subdomain) return response;

    const org = await getCurrentOrg(subdomain, true);
    if (!org) return response;

    return {
      ...response,
      org,
      isOrgSite: true,
      orgSiteName: subdomain
    };
  }

  /* -------------------------------------------------------------------------- */
  /* LOCAL DEBUG COOKIE SUPPORT                                                 */
  /* -------------------------------------------------------------------------- */

  const tempOrg = url.searchParams.get('org');
  if (isLocal && tempOrg) {
    cookies.set('_orgSiteName', tempOrg, { path: '/' });
  }

  const cookieOrg = cookies.get('_orgSiteName');
  const debugPlay = cookies.get('debugPlay') === 'true';
  const debugMode = cookieOrg && cookieOrg !== 'false';

  const subdomain = getSubdomain(url) ?? '';

  /* -------------------------------------------------------------------------- */
  /* CUSTOM DOMAIN                                                              */
  /* -------------------------------------------------------------------------- */

  if (isCustomDomain(url)) {
    const org = await getCurrentOrg(host, true, true);
    if (!org) return response;

    return {
      ...response,
      org,
      isOrgSite: true,
      orgSiteName: org.siteName ?? ''
    };
  }

  /* -------------------------------------------------------------------------- */
  /* BLOCKED SUBDOMAINS                                                         */
  /* -------------------------------------------------------------------------- */

  if (blockedSubdomain.includes(subdomain)) {
    if (subdomain === 'play' || debugPlay) {
      return { ...response, skipAuth: true };
    }

    if (!isDevEnv) {
      throw redirect(307, origin);
    }

    return response;
  }

  /* -------------------------------------------------------------------------- */
  /* APP SUBDOMAIN (dashboard, staging, etc.)                                  */
  /* -------------------------------------------------------------------------- */

  if (APP_SUBDOMAINS.includes(subdomain)) {
    return response;
  }

  /* -------------------------------------------------------------------------- */
  /* ORG SUBDOMAIN                                                              */
  /* -------------------------------------------------------------------------- */

  const orgSiteName = debugMode ? cookieOrg : subdomain;
  if (!orgSiteName) return response;

  const org = await getCurrentOrg(orgSiteName, true);

  if (!org) {
    if (!isDevEnv) {
      throw redirect(307, `${origin}/404?type=org`);
    }

    if (cookieOrg) {
      cookies.delete('_orgSiteName', { path: '/' });
    }

    return response;
  }

  return {
    ...response,
    org,
    isOrgSite: true,
    orgSiteName
  };
};

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function isCustomDomain(url: URL) {
  if (url.host.includes('localhost')) return false;

  const notCustomHosts = [
    env.PRIVATE_APP_HOST,
    'classroomio.com',
    'vercel.app'
  ].filter(Boolean);

  return !notCustomHosts.some((host) => url.host.endsWith(host));
}

function getSubdomain(url: URL) {
  const hostname = url.hostname.replace('www.', '');
  const parts = hostname.split('.');
  const appHost = env.PRIVATE_APP_HOST;

  if (!appHost) return null;

  const appParts = appHost.split('.');
  const isAppHost =
    parts.slice(-appParts.length).join('.') === appHost;

  return isAppHost && parts.length > appParts.length
    ? parts[0]
    : null;
}

function getBaseMetaTags(url: URL): MetaTagsProps {
  const canonical = new URL(url.pathname, url.origin).href;

  return Object.freeze({
    title:
      'ClassroomIO | The Open Source Learning Management System for Companies',
    description:
      'A flexible, user-friendly platform for creating, managing, and delivering courses for companies and training organisations',
    canonical,
    openGraph: {
      type: 'website',
      url: canonical,
      locale: 'en_IE',
      title:
        'ClassroomIO | The Open Source Learning Management System for Companies',
      description:
        'A flexible, user-friendly platform for creating, managing, and delivering courses for companies and training organisations',
      siteName: 'ClassroomIO',
      images: [
        {
          url: 'https://brand.cdn.clsrio.com/og/classroomio-og.png',
          alt: 'ClassroomIO OG Image',
          width: 1920,
          height: 1080,
          secureUrl:
            'https://brand.cdn.clsrio.com/og/classroomio-og.png',
          type: 'image/jpeg'
        }
      ]
    },
    twitter: {
      handle: '@zumokenya',
      site: '@zumokenya',
      cardType: 'summary_large_image',
      title:
        'ClassroomIO | The Open Source Learning Management System for Companies',
      description:
        'A flexible, user-friendly platform for creating, managing, and delivering courses for companies and training organisations',
      image:
        'https://brand.cdn.clsrio.com/og/classroomio-og.png',
      imageAlt: 'ClassroomIO OG Image'
    }
  } satisfies MetaTagsProps);
}