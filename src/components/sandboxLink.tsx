import {getCurrentPlatform} from 'sentry-docs/docTree';
import {serverContext} from 'sentry-docs/serverContext';

import {ExternalLink} from './externalLink';

const scenarios = [
  'performance',
  'releases',
  'alerts',
  'discover',
  'dashboards',
  'projects',
  'oneDiscoverQuery',
  'oneIssue',
  'oneBreadcrumb',
  'oneStackTrace',
  'oneTransaction',
  'oneWebVitals',
  'oneTransactionSummary',
  'oneRelease',
] as const;

type Props = {
  children: React.ReactNode;
  errorType?: string;
  platform?: string;
  projectSlug?: string;
  scenario?: (typeof scenarios)[number];
  target?: string;
};

/**
 * Obtains the URL to the sandbox start endpoint.
 * @param param0.scenario: One of the scenarios. Determins where in the sandbox
 * the user will be landed.
 * @param param0.projectSlug:
 * One of react, python, react-native, android, iOS
 * @param param0.errorType: A string matching the title of the error.
 * @returns URL to the sandbox start endpoint
 */
export function getSandboxURL({
  scenario,
  projectSlug,
  errorType,
}: {
  errorType?: string;
  projectSlug?: string;
  scenario?: (typeof scenarios)[number];
} = {}) {
  const url = new URL('https://sandbox.sentry.io/');

  if (scenario) {
    url.searchParams.append('scenario', scenario);
  }

  if (projectSlug) {
    url.searchParams.append('projectSlug', projectSlug);
  }

  if (errorType) {
    url.searchParams.append('errorType', errorType);
  }
  url.searchParams.append('source', 'docs');

  return url;
}

export const isSandboxHidden = () => process.env.GATSBY_HIDE_SANDBOX === '1';

const SANDBOX_PLATFORMS = ['react', 'python', 'react-native', 'android', 'ios'] as const;

const SANDBOX_PLATFORM_MAP: {[key: string]: string} = {
  apple: 'ios',
  javascript: 'react',
  node: 'react',
};

export function SandboxLink({children, target, ...params}: Props) {
  if (isSandboxHidden()) {
    return children;
  }

  const {rootNode, path} = serverContext();
  const currentPlatform = getCurrentPlatform(rootNode, path);

  const currentPlatformkey = currentPlatform?.key ?? 'unknown';

  if (!params.projectSlug) {
    if ((SANDBOX_PLATFORMS as readonly string[]).includes(currentPlatformkey)) {
      params.projectSlug = currentPlatformkey;
    } else if (SANDBOX_PLATFORM_MAP[currentPlatformkey]) {
      params.projectSlug = SANDBOX_PLATFORM_MAP[currentPlatformkey];
    }
  }

  return (
    <ExternalLink href={getSandboxURL(params).toString()} target={target || '_blank'}>
      {children}
    </ExternalLink>
  );
}

export function SandboxOnly({children}) {
  // kill switch for sandbox
  if (isSandboxHidden()) {
    return null;
  }
  return children;
}
