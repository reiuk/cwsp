import { memo } from 'react';
import { c } from '../theme';

export const CitationFooter = memo(function CitationFooter() {
  return (
    <footer style={{
      flexShrink: 0,
      padding: '7px 16px',
      borderTop: `1px solid ${c.line}`,
      background: c.surface,
      color: c.faint,
      fontSize: 10.5,
      lineHeight: 1.5,
    }}>
      Parameters from Menon, Flegg et al. (2012) <em>Proc. R. Soc. B</em> 279, 3329-3338;
      Nagaraja et al. (2017, 2019) <em>Frontiers in Physiology</em>; Alves/Maddocks et al. (2018).
      Clinical timecourse from Singer &amp; Clark (1999) <em>NEJM</em>.
      Extends the Menon 1D framework to a 2D cross-section.
    </footer>
  );
});
