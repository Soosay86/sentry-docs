'use client';

import {createContext, useEffect, useState} from 'react';
import Cookies from 'js-cookie';

import {isLocalStorageAvailable} from 'sentry-docs/utils';

import {OnboardingOptionType} from './onboarding';

type ProjectCodeKeywords = {
  API_URL: string;
  DSN: string;
  MINIDUMP_URL: string;
  ORG_ID: number;
  ORG_INGEST_DOMAIN: string;
  ORG_SLUG: string;
  OTLP_TRACES_URL: string;
  PROJECT_ID: number;
  PROJECT_SLUG: string;
  PUBLIC_DSN: string;
  PUBLIC_KEY: string;
  SECRET_KEY: string;
  UNREAL_URL: string;
  title: string;
};

type UserCodeKeywords = {
  ID: number;
  NAME: string;
};

type CodeKeywords = {
  PROJECT: ProjectCodeKeywords[];
  USER: UserCodeKeywords | undefined;
};

type Dsn = {
  host: string;
  pathname: string;
  publicKey: string;
  scheme: string;
  secretKey?: string;
};

type ProjectApiResult = {
  dsn: string;
  dsnPublic: string;
  id: number;
  name: string;
  organizationId: number;
  organizationName: string;
  organizationSlug: string;
  projectName: string;
  projectSlug: string;
  publicKey: string;
  secretKey: string;
};

type UserApiResult = {
  avatarUrl: string;
  id: number;
  isAuthenticated: boolean;
  name: string;
};

type Region = {
  name: string;
  url: string;
};

// only fetch them once
let cachedCodeKeywords: CodeKeywords | null = null;

export const DEFAULTS: CodeKeywords = {
  PROJECT: [
    {
      DSN: 'https://examplePublicKey@o0.ingest.sentry.io/0',
      PUBLIC_DSN: 'https://examplePublicKey@o0.ingest.sentry.io/0',
      PUBLIC_KEY: 'examplePublicKey',
      SECRET_KEY: 'exampleSecretKey',
      API_URL: 'https://sentry.io/api',
      PROJECT_ID: 0,
      PROJECT_SLUG: 'example-project',
      ORG_ID: 0,
      ORG_SLUG: 'example-org',
      ORG_INGEST_DOMAIN: 'o0.ingest.sentry.io',
      MINIDUMP_URL:
        'https://o0.ingest.sentry.io/api/0/minidump/?sentry_key=examplePublicKey',
      UNREAL_URL: 'https://o0.ingest.sentry.io/api/0/unreal/examplePublicKey/',
      OTLP_TRACES_URL: 'https://o0.ingest.sentry.io/api/0/otlp/v1/traces',
      title: `example-org / example-project`,
    },
  ],
  USER: undefined,
};

type SelectedCodeTabs = Record<string, string | undefined>;
type CodeSelection = {
  groupId: string;
  selection: string;
};

type CodeContextType = {
  codeKeywords: CodeKeywords;
  isLoading: boolean;
  onboardingOptions: OnboardingOptionType[];
  sharedKeywordSelection: [
    Record<string, number>,
    React.Dispatch<Record<string, number>>,
  ];
  storedCodeSelection: SelectedCodeTabs;
  updateCodeSelection: (selection: CodeSelection) => void;
  updateOnboardingOptions: (options: OnboardingOptionType[]) => void;
};

export const CodeContext = createContext<CodeContextType | null>(null);

function parseDsn(dsn: string): Dsn {
  const match = dsn.match(/^(.*?\/\/)(.*?):(.*?)@(.*?)(\/.*?)$/);

  if (match === null) {
    throw new Error('Failed to parse DSN');
  }

  return {
    scheme: match[1],
    publicKey: escape(match[2]),
    secretKey: escape(match[3]),
    host: escape(match[4]),
    pathname: escape(match[5]),
  };
}

const formatMinidumpURL = ({scheme, host, pathname, publicKey}: Dsn) => {
  return `${scheme}${host}/api${pathname}/minidump/?sentry_key=${publicKey}`;
};

const formatUnrealEngineURL = ({scheme, host, pathname, publicKey}: Dsn) => {
  return `${scheme}${host}/api${pathname}/unreal/${publicKey}/`;
};

const formatOtlpTracesUrl = ({scheme, host, pathname}: Dsn) => {
  return `${scheme}${host}/api${pathname}/otlp/v1/traces`;
};

const formatApiUrl = ({scheme, host}: Dsn) => {
  const apiHost = host.indexOf('.ingest.') >= 0 ? host.split('.ingest.')[1] : host;

  return `${scheme}${apiHost}/api`;
};

function getHost(): string {
  if (process.env.NODE_ENV === 'development') {
    return 'http://dev.getsentry.net:8000';
  }
  return 'https://sentry.io';
}

function makeDefaults() {
  // eslint-disable-next-line no-console
  console.warn('Unable to fetch codeContext - using defaults.');
  return DEFAULTS;
}

/**
 * Fetch project details from sentry
 */
export async function fetchCodeKeywords(): Promise<CodeKeywords> {
  let json: {projects: ProjectApiResult[]; user: UserApiResult | undefined} = {
    projects: [],
    user: undefined,
  };

  // First fetch which regions the user has a presence
  const url = `${getHost()}/api/0/users/me/regions/`;
  let regions: Region[] = [];
  try {
    const resp = await fetch(url, {credentials: 'include'});
    if (!resp.ok) {
      return makeDefaults();
    }
    const data = await resp.json();
    if (data.regions) {
      regions = data.regions;
    }
  } catch (e) {
    return makeDefaults();
  }

  // Then fetch the project configuration for each region, and merge it together.
  const results = await Promise.all(
    regions.map(async region => {
      const regionUrl = `${region.url}/docs/api/user/`;
      try {
        const resp = await fetch(regionUrl, {credentials: 'include'});
        if (!resp.ok) {
          return makeDefaults();
        }
        return resp.json();
      } catch (e) {
        return makeDefaults();
      }
    })
  );
  json = results.reduce((acc, item) => {
    if (item.projects) {
      acc.projects = acc.projects.concat(item.projects);
    }
    if (item.user) {
      acc.user = item.user;
    }
    return acc;
  }, json);

  const {projects, user} = json;

  if (projects?.length === 0) {
    return makeDefaults();
  }

  return {
    PROJECT: projects.map(project => {
      const parsedDsn = parseDsn(project.dsn);
      return {
        DSN: project.dsn,
        PUBLIC_DSN: project.dsnPublic,
        PUBLIC_KEY: parsedDsn.publicKey,
        SECRET_KEY: parsedDsn.secretKey ?? 'exampleSecretKey',
        API_URL: formatApiUrl(parsedDsn),
        PROJECT_ID: project.id,
        PROJECT_SLUG: project.projectSlug,
        ORG_ID: project.organizationId,
        ORG_SLUG: project.organizationSlug,
        ORG_INGEST_DOMAIN:
          parsedDsn.host ?? `o${project.organizationId}.ingest.sentry.io`,
        MINIDUMP_URL: formatMinidumpURL(parsedDsn),
        UNREAL_URL: formatUnrealEngineURL(parsedDsn),
        OTLP_TRACES_URL: formatOtlpTracesUrl(parsedDsn),
        title: `${project.organizationSlug} / ${project.projectSlug}`,
      };
    }),
    USER: user?.isAuthenticated
      ? {
          ID: user.id,
          NAME: user.name,
        }
      : undefined,
  };
}

function getCsrfToken(): string {
  // is sentry-sc in production, but may also be sc in other envs
  // So we just try both variants
  const cookieNames = ['sentry-sc', 'sc'];

  const value = cookieNames
    .map(cookieName => Cookies.get(cookieName))
    .find(token => token !== null);

  return value ?? '';
}

export async function createOrgAuthToken({
  orgSlug,
  name,
}: {
  name: string;
  orgSlug: string;
}): Promise<string | null> {
  const url = `${getHost()}/api/0/organizations/${orgSlug}/org-auth-tokens/`;

  const body = {name};

  try {
    const resp = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(body),
      credentials: 'include',
      headers: {
        Accept: 'application/json; charset=utf-8',
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
    });

    if (!resp.ok) {
      return null;
    }

    const json = await resp.json();

    return json.token;
  } catch {
    return null;
  }
}

const getLocallyStoredSelections = (): SelectedCodeTabs => {
  if (isLocalStorageAvailable()) {
    return Object.fromEntries(
      Object.entries(localStorage).filter(([key]) => key.startsWith('Tabgroup:'))
    );
  }
  return {};
};

export function CodeContextProvider({children}: {children: React.ReactNode}) {
  const [codeKeywords, setCodeKeywords] = useState(cachedCodeKeywords ?? DEFAULTS);
  const [isLoading, setIsLoading] = useState<boolean>(cachedCodeKeywords ? false : true);
  const [storedCodeSelection, setStoredCodeSelection] = useState<SelectedCodeTabs>({});
  const [onboardingOptions, setOnboardingOptions] = useState<OnboardingOptionType[]>([]);

  // populate state using localstorage
  useEffect(() => {
    setStoredCodeSelection(getLocallyStoredSelections());
  }, []);

  useEffect(() => {
    if (cachedCodeKeywords === null) {
      setIsLoading(true);
      fetchCodeKeywords().then((config: CodeKeywords) => {
        cachedCodeKeywords = config;
        setCodeKeywords(config);
        setIsLoading(false);
      });
    }
  }, [setIsLoading, setCodeKeywords]);

  const updateCodeSelection = ({groupId, selection}: CodeSelection) => {
    // update context state
    setStoredCodeSelection(current => {
      return {
        ...current,
        [groupId]: selection,
      };
    });

    // update local storage
    if (isLocalStorageAvailable()) {
      localStorage.setItem(groupId, selection);
    }
  };

  // sharedKeywordSelection maintains a global mapping for each "keyword"
  // namespace to the index of the selected item.
  //
  // NOTE: This ONLY does anything for the `PROJECT` keyword namespace, since
  // that is the only namespace that actually has a list
  const sharedKeywordSelection = useState<Record<string, number>>({});

  const result: CodeContextType = {
    codeKeywords,
    storedCodeSelection,
    updateCodeSelection,
    sharedKeywordSelection,
    isLoading,
    onboardingOptions,
    updateOnboardingOptions: options => setOnboardingOptions(options),
  };

  return <CodeContext.Provider value={result}>{children}</CodeContext.Provider>;
}

/** For tests only. */
export function _setCachedCodeKeywords(codeKeywords: CodeKeywords) {
  cachedCodeKeywords = codeKeywords;
}
