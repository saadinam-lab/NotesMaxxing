import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/**
 * Generates a realistic 4-page university study PDF completely client-side
 * so first-time users can explore highlighting, circling, dark mode, and notes immediately.
 */
export async function generateSampleStudyPdf(): Promise<File> {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);

  const pageWidth = 612;
  const pageHeight = 792;

  const pagesContent = [
    {
      chapter: 'CS 4410 - DISTRIBUTED SYSTEMS & CONSENSUS',
      title: '1. Logical Time, Lamport Clocks & Vector Ordering',
      paragraphs: [
        'In asynchronous distributed systems, physical wall-clock synchronization (such as NTP) cannot guarantee strict event ordering across independent nodes due to unbounded clock drift and network latency.',
        'Leslie Lamport introduced the happened-before relation (a -> b) to define a partial causal order without relying on physical clocks. Whenever process P_i sends a message m, it increments its logical counter C_i and attaches t = C_i to m.',
        'Key Invariant: If event a happens before event b (a -> b), then C(a) < C(b). However, the converse does not hold for scalar Lamport timestamps: C(a) < C(b) does not imply causal dependence between concurrent events.',
        'Vector Clocks solve this limitation by maintaining an array V_i[1..N] on each node. Event a causally precedes event b if and only if V(a)[k] <= V(b)[k] for all k and V(a) != V(b).',
      ],
      callout: 'Exam Tip: Always distinguish partial causal order (Lamport) from exact concurrency detection (Vector Clocks).',
      diagramTitle: 'Figure 1.1: Causal Message Passing Across Three Replicas',
    },
    {
      chapter: 'CS 4410 - DISTRIBUTED SYSTEMS & CONSENSUS',
      title: '2. Raft Consensus: Leader Election & Log Replication',
      paragraphs: [
        'Raft decomposes consensus into three relatively independent subproblems: Leader Election, Log Replication, and Safety. Time is divided into monotonically increasing terms numbered with consecutive integers.',
        'If a follower receives no AppendEntries heartbeat before its randomized election timeout expires (typically 150ms to 300ms), it transitions to Candidate state, increments currentTerm, votes for itself, and broadcasts RequestVote RPCs.',
        'Log Matching Property: If two logs contain an entry with the same index and term, then the logs are identical in all entries up through the given index. Leaders never overwrite or delete entries in their own logs.',
        'A log entry is committed once the leader has replicated it to a strict majority quorum (floor(N/2) + 1) of servers in the current term, guaranteeing durability across minority failures.',
      ],
      callout: 'Safety Rule: A candidate can only win an election if its log is at least as up-to-date as any majority quorum.',
      diagramTitle: 'Figure 2.1: Raft State Transitions (Follower -> Candidate -> Leader)',
    },
    {
      chapter: 'CS 4410 - DISTRIBUTED SYSTEMS & CONSENSUS',
      title: '3. The CAP Theorem & PACELC Trade-offs',
      paragraphs: [
        'Brewer and Gilbert-Lynch formalized that during a network partition (P), a distributed data store must choose between Linearizable Consistency (C) and 100% Availability (A) for every non-failing node.',
        'Because network partitions are unavoidable in wide-area deployments, practical architectures are categorized as either CP (e.g., etcd, ZooKeeper, Spanner) or AP (e.g., Dynamo-style eventual consistency stores).',
        'PACELC extends CAP to normal operation: if there is a Partition (P), trade off Availability vs Consistency; Else (E), even without partitions, systems trade off Latency (L) vs Consistency (C).',
        'Quorum Tuning Formula: With N replicas, write quorum W, and read quorum R, strong overlap requires W + R > N. Setting W = 2, R = 2, N = 3 tolerates 1 node failure while preserving fresh reads.',
      ],
      callout: 'Formula to Circle: W + R > N guarantees read-your-writes overlap across replica quorums.',
      diagramTitle: 'Figure 3.1: Quorum Intersection Grid (N=3, W=2, R=2)',
    },
    {
      chapter: 'CS 4410 - DISTRIBUTED SYSTEMS & CONSENSUS',
      title: '4. Two-Phase Commit (2PC) & Optimistic Concurrency',
      paragraphs: [
        'Two-Phase Commit coordinates atomic distributed transactions across multiple shards. In Phase 1 (Prepare), the coordinator asks all participants to flush undo/redo logs to stable storage and vote Yes or Abort.',
        'In Phase 2 (Commit/Abort), if every participant voted Yes, the coordinator writes a commit record and broadcasts Commit. Unfortunately, 2PC is a blocking protocol if the coordinator crashes after participants vote Yes.',
        'Percolator and Spanner mitigate coordinator blocking by backing locks with Paxos/Raft state machines, ensuring transaction metadata remains highly available even during single-datacenter outages.',
        'Review Checklist: Compare 2PC blocking failure modes against Raft-replicated commit records before Thursday midterm.',
      ],
      callout: 'Study Note: Attach lecture video timestamps and handwritten quorum diagrams directly to highlighted paragraphs.',
      diagramTitle: 'Figure 4.1: Two-Phase Commit Coordinator & Participant Timeline',
    },
  ];

  pagesContent.forEach((sec, idx) => {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - 54;

    page.drawText(sec.chapter, {
      x: 56,
      y,
      size: 9,
      font: fontMono,
      color: rgb(0.42, 0.42, 0.46),
    });
    page.drawText(`Page ${idx + 1} of ${pagesContent.length}`, {
      x: pageWidth - 115,
      y,
      size: 9,
      font: fontMono,
      color: rgb(0.42, 0.42, 0.46),
    });

    y -= 26;
    page.drawText(sec.title, {
      x: 56,
      y,
      size: 18,
      font: fontBold,
      color: rgb(0.08, 0.08, 0.1),
    });

    y -= 12;
    page.drawLine({
      start: { x: 56, y },
      end: { x: pageWidth - 56, y },
      thickness: 1,
      color: rgb(0.84, 0.84, 0.87),
    });

    y -= 26;
    for (const para of sec.paragraphs) {
      const words = para.split(' ');
      let line = '';
      for (const w of words) {
        const next = line ? `${line} ${w}` : w;
        if (next.length > 78) {
          page.drawText(line, {
            x: 56,
            y,
            size: 11.5,
            font: fontRegular,
            color: rgb(0.14, 0.14, 0.17),
          });
          y -= 17;
          line = w;
        } else {
          line = next;
        }
      }
      if (line) {
        page.drawText(line, {
          x: 56,
          y,
          size: 11.5,
          font: fontRegular,
          color: rgb(0.14, 0.14, 0.17),
        });
        y -= 26;
      }
    }

    // Callout box with clean line wrapping
    const calloutWords = sec.callout.split(' ');
    const calloutLines: string[] = [];
    let calloutCurr = '';
    for (const cw of calloutWords) {
      const next = calloutCurr ? `${calloutCurr} ${cw}` : cw;
      if (next.length > 74) {
        calloutLines.push(calloutCurr);
        calloutCurr = cw;
      } else {
        calloutCurr = next;
      }
    }
    if (calloutCurr) calloutLines.push(calloutCurr);

    const calloutHeight = 20 + calloutLines.length * 15;
    y -= 4;
    page.drawRectangle({
      x: 56,
      y: y - calloutHeight + 10,
      width: pageWidth - 112,
      height: calloutHeight,
      color: rgb(0.96, 0.95, 0.92),
      borderColor: rgb(0.82, 0.78, 0.7),
      borderWidth: 0.8,
    });
    calloutLines.forEach((cLine, cIdx) => {
      page.drawText(cLine, {
        x: 68,
        y: y - 10 - cIdx * 15,
        size: 10,
        font: fontBold,
        color: rgb(0.2, 0.18, 0.12),
      });
    });

    // Simple vector diagram area at bottom so Circle/Draw mode has something great to circle
    y -= calloutHeight + 24;
    page.drawRectangle({
      x: 56,
      y: y - 120,
      width: pageWidth - 112,
      height: 120,
      borderColor: rgb(0.75, 0.75, 0.8),
      borderWidth: 1,
      color: rgb(0.99, 0.99, 1),
    });
    page.drawText(sec.diagramTitle, {
      x: 68,
      y: y - 18,
      size: 9.5,
      font: fontBold,
      color: rgb(0.3, 0.3, 0.35),
    });

    // Three replica nodes + arrows
    const boxY = y - 78;
    const nodeLabels = ['Node A', 'Node B', 'Node C'];
    nodeLabels.forEach((lbl, nIdx) => {
      const bx = 92 + nIdx * 165;
      page.drawRectangle({
        x: bx,
        y: boxY,
        width: 96,
        height: 36,
        borderColor: rgb(0.35, 0.35, 0.42),
        borderWidth: 1.2,
        color: rgb(0.95, 0.96, 0.98),
      });
      page.drawText(lbl, {
        x: bx + 26,
        y: boxY + 13,
        size: 10,
        font: fontMono,
        color: rgb(0.15, 0.15, 0.2),
      });
      if (nIdx < 2) {
        page.drawLine({
          start: { x: bx + 98, y: boxY + 18 },
          end: { x: bx + 163, y: boxY + 18 },
          thickness: 1.2,
          color: rgb(0.4, 0.4, 0.45),
        });
      }
    });
  });

  const bytes = await pdfDoc.save();
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new File([buffer], 'Distributed_Systems_Lecture_Notes.pdf', {
    type: 'application/pdf',
  });
}
