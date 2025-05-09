'use client';

import {Fragment, useContext} from 'react';
import {usePathname} from 'next/navigation';

import {Alert} from './alert';
import {CodeContext} from './codeContext';
import {ExternalLink} from './externalLink';
import {SignedInCheck} from './signedInCheck';

export function OrgAuthTokenNote() {
  const pathname = usePathname();
  const url = 'https://docs.sentry.io' + pathname;

  const orgAuthTokenUrl = useOrgAuthTokenUrl();

  return (
    <Fragment>
      <SignedInCheck isUserAuthenticated={false}>
        <Alert>
          You can{' '}
          <ExternalLink href={orgAuthTokenUrl} target="_blank">
            manually create an Auth Token
          </ExternalLink>{' '}
          or{' '}
          <ExternalLink href={`https://sentry.io/auth/login/?next=${url}`}>
            sign in
          </ExternalLink>{' '}
          to create a token directly from this page.
        </Alert>
      </SignedInCheck>

      <SignedInCheck isUserAuthenticated>
        <Alert level="warning">
          You can{' '}
          <ExternalLink href={orgAuthTokenUrl} target="_blank">
            manually create an Auth Token
          </ExternalLink>{' '}
          or create a token directly from this page. A created token will only be visible
          once right after creation - make sure to copy-paste it immediately and DO NOT
          commit it! We recommend adding it as an environment variable.
        </Alert>
      </SignedInCheck>
    </Fragment>
  );
}

export function useOrgAuthTokenUrl() {
  const context = useContext(CodeContext);

  // When not signed in, we use a redirect URL that uses the last org the user visited
  if (context === null || !context.codeKeywords.USER) {
    return 'https://sentry.io/orgredirect/organizations/:orgslug/settings/auth-tokens/';
  }

  const [sharedSelection] = context.sharedKeywordSelection;

  const choices = context.codeKeywords?.PROJECT;
  const currentSelectionIdx = sharedSelection.PROJECT ?? 0;
  const currentSelection = choices[currentSelectionIdx];

  const org = currentSelection.ORG_SLUG;

  return `https://sentry.io/settings/${org}/auth-tokens/`;
}
