import { jsPDF } from 'jspdf';
import { Room, Group, ActionItem, PostIt, Participant } from '../../../shared/types';

// Colors
const COLORS = {
  primary: [47, 129, 247] as [number, number, number],      // #2f81f7
  green: [63, 185, 80] as [number, number, number],         // #3fb950
  red: [248, 81, 73] as [number, number, number],           // #f85149
  dark: [13, 17, 23] as [number, number, number],           // #0d1117
  text: [230, 237, 243] as [number, number, number],        // #e6edf3
  textSecondary: [139, 148, 158] as [number, number, number], // #8b949e
  white: [255, 255, 255] as [number, number, number],
  lightBg: [240, 240, 240] as [number, number, number],
};

interface ExportOptions {
  room: Room;
  translations: {
    title: string;
    participants: string;
    ideas: string;
    topics: string;
    actionItems: string;
    votes: string;
    assignee: string;
    team: string;
    generatedOn: string;
    topicsPriority: string;
    noActions: string;
  };
}

export const exportToPDF = ({ room, translations: t }: ExportOptions): void => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;
  let y = margin;

  // Helper functions
  const setColor = (color: [number, number, number]) => {
    doc.setTextColor(color[0], color[1], color[2]);
  };

  const setFillColor = (color: [number, number, number]) => {
    doc.setFillColor(color[0], color[1], color[2]);
  };

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
      return true;
    }
    return false;
  };

  const drawRoundedRect = (x: number, yPos: number, w: number, h: number, r: number, fill: [number, number, number]) => {
    setFillColor(fill);
    doc.roundedRect(x, yPos, w, h, r, r, 'F');
  };

  // Sort groups by votes
  const sortedGroups = [...room.groups].sort((a, b) => (b.votes?.length || 0) - (a.votes?.length || 0));

  // === HEADER ===
  setFillColor(COLORS.primary);
  doc.rect(0, 0, pageWidth, 35, 'F');

  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  setColor(COLORS.white);
  doc.text(room.name, margin, 18);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const dateStr = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  doc.text(`${t.generatedOn}: ${dateStr}`, margin, 28);

  y = 45;

  // === STATS BOXES ===
  const statsBoxWidth = (contentWidth - 15) / 4;
  const stats = [
    { label: t.participants, value: room.participants.length, color: COLORS.primary },
    { label: t.ideas, value: room.postits.length, color: COLORS.textSecondary },
    { label: t.topics, value: room.groups.length, color: COLORS.textSecondary },
    { label: t.actionItems, value: room.actionItems.length, color: COLORS.green },
  ];

  stats.forEach((stat, index) => {
    const x = margin + index * (statsBoxWidth + 5);
    drawRoundedRect(x, y, statsBoxWidth, 20, 3, COLORS.lightBg);
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    setColor(stat.color);
    doc.text(stat.value.toString(), x + statsBoxWidth / 2, y + 10, { align: 'center' });
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    setColor(COLORS.textSecondary);
    doc.text(stat.label, x + statsBoxWidth / 2, y + 16, { align: 'center' });
  });

  y += 30;

  // === ACTION ITEMS SECTION ===
  if (room.actionItems.length > 0) {
    checkPageBreak(20);
    
    // Section header
    setFillColor(COLORS.green);
    doc.rect(margin, y, 3, 10, 'F');
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    setColor(COLORS.dark);
    doc.text(t.actionItems, margin + 8, y + 7);
    y += 15;

    // Action items list
    room.actionItems.forEach((action: ActionItem) => {
      checkPageBreak(12);
      
      const topic = room.groups.find(g => g.id === action.groupId);
      
      // Checkbox
      doc.setDrawColor(139, 148, 158);
      doc.setLineWidth(0.3);
      if (action.status === 'DONE') {
        setFillColor(COLORS.green);
        doc.roundedRect(margin, y, 4, 4, 1, 1, 'FD');
        setColor(COLORS.white);
        doc.setFontSize(8);
        doc.text('✓', margin + 0.8, y + 3.2);
      } else {
        doc.roundedRect(margin, y, 4, 4, 1, 1, 'D');
      }

      // Action text
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      setColor(action.status === 'DONE' ? COLORS.textSecondary : COLORS.dark);
      const actionText = doc.splitTextToSize(action.content, contentWidth - 50);
      doc.text(actionText, margin + 8, y + 3);

      // Assignee
      doc.setFontSize(8);
      setColor(COLORS.primary);
      const assignee = `@${action.ownerName || t.team}`;
      doc.text(assignee, pageWidth - margin - doc.getTextWidth(assignee), y + 3);

      y += Math.max(actionText.length * 5, 8);

      // Topic reference
      if (topic) {
        doc.setFontSize(7);
        setColor(COLORS.textSecondary);
        doc.text(`→ ${topic.title}`, margin + 8, y);
        y += 5;
      }

      y += 2;
    });

    y += 10;
  }

  // === TOPICS BY PRIORITY ===
  checkPageBreak(20);
  
  setFillColor(COLORS.primary);
  doc.rect(margin, y, 3, 10, 'F');
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  setColor(COLORS.dark);
  doc.text(t.topicsPriority, margin + 8, y + 7);
  y += 15;

  sortedGroups.forEach((group: Group, index: number) => {
    const groupPostits = room.postits.filter((p: PostIt) => p.groupId === group.id);
    const groupActions = room.actionItems.filter((a: ActionItem) => a.groupId === group.id);
    
    // Estimate height needed
    const estimatedHeight = 25 + Math.ceil(groupPostits.length / 3) * 15;
    checkPageBreak(estimatedHeight);

    // Topic card background
    drawRoundedRect(margin, y, contentWidth, 20 + Math.ceil(groupPostits.length / 3) * 12, 3, COLORS.lightBg);

    // Rank badge
    setFillColor(COLORS.primary);
    doc.roundedRect(margin + 3, y + 3, 10, 10, 2, 2, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    setColor(COLORS.white);
    doc.text(`#${index + 1}`, margin + 8, y + 9.5, { align: 'center' });

    // Topic title
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    setColor(COLORS.dark);
    const titleLines = doc.splitTextToSize(group.title, contentWidth - 80);
    doc.text(titleLines, margin + 18, y + 9);

    // Badges
    let badgeX = pageWidth - margin - 5;
    
    // Actions badge
    if (groupActions.length > 0) {
      const actionsText = `${groupActions.length} actions`;
      const actionsWidth = doc.getTextWidth(actionsText) + 6;
      badgeX -= actionsWidth;
      setFillColor(COLORS.green);
      doc.roundedRect(badgeX, y + 4, actionsWidth, 6, 2, 2, 'F');
      doc.setFontSize(7);
      setColor(COLORS.white);
      doc.text(actionsText, badgeX + 3, y + 8.5);
      badgeX -= 3;
    }

    // Ideas badge
    const ideasText = `${groupPostits.length} ideas`;
    const ideasWidth = doc.getTextWidth(ideasText) + 6;
    badgeX -= ideasWidth;
    setFillColor([200, 200, 200]);
    doc.roundedRect(badgeX, y + 4, ideasWidth, 6, 2, 2, 'F');
    doc.setFontSize(7);
    setColor(COLORS.dark);
    doc.text(ideasText, badgeX + 3, y + 8.5);
    badgeX -= 3;

    // Votes badge
    const votesText = `${group.votes?.length || 0} ${t.votes}`;
    const votesWidth = doc.getTextWidth(votesText) + 6;
    badgeX -= votesWidth;
    setFillColor(COLORS.primary);
    doc.roundedRect(badgeX, y + 4, votesWidth, 6, 2, 2, 'F');
    doc.setFontSize(7);
    setColor(COLORS.white);
    doc.text(votesText, badgeX + 3, y + 8.5);

    // Ideas preview
    y += 16;
    let ideaX = margin + 5;
    let ideaY = y;
    const maxIdeasPerRow = 3;
    let ideasInRow = 0;

    groupPostits.slice(0, 6).forEach((postit: PostIt) => {
      if (ideasInRow >= maxIdeasPerRow) {
        ideaX = margin + 5;
        ideaY += 10;
        ideasInRow = 0;
      }

      const ideaText = postit.content.length > 25 
        ? postit.content.substring(0, 25) + '...' 
        : postit.content;
      
      setFillColor([255, 249, 196]); // Post-it yellow
      const textWidth = Math.min(doc.getTextWidth(ideaText) + 4, 55);
      doc.roundedRect(ideaX, ideaY, textWidth, 8, 1, 1, 'F');
      
      doc.setFontSize(7);
      setColor(COLORS.dark);
      doc.text(ideaText.substring(0, 30), ideaX + 2, ideaY + 5.5);

      ideaX += textWidth + 3;
      ideasInRow++;
    });

    if (groupPostits.length > 6) {
      doc.setFontSize(7);
      setColor(COLORS.textSecondary);
      doc.text(`+${groupPostits.length - 6} more`, ideaX, ideaY + 5.5);
    }

    y = ideaY + 15;
  });

  // === PARTICIPANTS ===
  checkPageBreak(30);
  y += 5;
  
  setFillColor(COLORS.textSecondary);
  doc.rect(margin, y, 3, 10, 'F');
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  setColor(COLORS.dark);
  doc.text(t.participants, margin + 8, y + 7);
  y += 15;

  let participantX = margin;
  room.participants.forEach((participant: Participant) => {
    const name = participant.name;
    const role = participant.role === 'FACILITATOR' ? ' (F)' : '';
    const text = name + role;
    const width = doc.getTextWidth(text) + 10;

    if (participantX + width > pageWidth - margin) {
      participantX = margin;
      y += 10;
    }

    // Avatar circle
    setFillColor(COLORS.primary);
    doc.circle(participantX + 4, y + 3, 4, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    setColor(COLORS.white);
    doc.text(name[0].toUpperCase(), participantX + 4, y + 4.5, { align: 'center' });

    // Name
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    setColor(COLORS.dark);
    doc.text(text, participantX + 10, y + 4.5);

    participantX += width + 5;
  });

  // === FOOTER ===
  const footerY = pageHeight - 10;
  doc.setFontSize(8);
  setColor(COLORS.textSecondary);
  doc.text('Generated by RetroFlow', margin, footerY);
  doc.text('retro.twibox.fr', pageWidth - margin - doc.getTextWidth('retro.twibox.fr'), footerY);

  // Save the PDF
  const fileName = `${room.name.replace(/[^a-z0-9]/gi, '_')}_retrospective_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};
