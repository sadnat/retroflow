import React, { useState } from 'react';
import { useRoom } from '../../context/RoomContext';
import { useSocket } from '../../context/SocketContext';
import { Column, PostIt, Participant, Group, ActionItem } from '../../../../shared/types';
import { t } from '../../i18n';
import { PhaseTutorial } from '../PhaseTutorial';
import { exportToPDF } from '../../services/pdfExport';

export const Board: React.FC = () => {
  const { room, odlUserId: userId } = useRoom();
  const { socket } = useSocket();
  const [isAddingTo, setIsAddingTo] = useState<string | null>(null);
  const [newContent, setNewContent] = useState('');

  // States for editing existing post-its
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  // State for dragging
  const [draggedId, setDraggedId] = useState<string | null>(null);

  // State for topic management
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editTopicTitle, setEditTopicTitle] = useState('');

  // State for action item management
  const [newActionContent, setNewActionContent] = useState<{ [groupId: string]: string }>({});
  const [newActionOwner, setNewActionOwner] = useState<{ [groupId: string]: string }>({});

  if (!room) return null;

  const isFacilitator = room.facilitatorId === userId;
  const focusedPostIt = room.postits.find((p: PostIt) => p.id === room.focusedPostItId);

  const handleAddPostIt = () => {
    if (!isAddingTo || !newContent.trim() || !userId) return;

    const user = room.participants.find((p: Participant) => p.id === userId);
    const authorName = user?.name || 'Inconnu';

    socket?.emit('postit:create', {
      roomId: room.id,
      content: newContent,
      columnId: isAddingTo,
      authorId: userId,
      authorName: authorName,
      color: '#fff9c4'
    });

    setNewContent('');
    setIsAddingTo(null);
  };

  const handleUpdatePostIt = (postitId: string) => {
    if (!editContent.trim()) {
      setEditingId(null);
      return;
    }
    socket?.emit('postit:update', { roomId: room.id, postitId, content: editContent });
    setEditingId(null);
    setEditContent('');
  };

  const handlePostItClick = (postit: PostIt) => {
    const isAuthor = postit.authorId === userId;
    const canEdit = isAuthor || isFacilitator;

    if ((room.phase === 'IDEATION' || room.phase === 'SETUP') && isAuthor) {
      setEditingId(postit.id);
      setEditContent(postit.content);
      return;
    }

    if (room.phase === 'DISCUSSION') {
      if (canEdit) {
        setEditingId(postit.id);
        setEditContent(postit.content);
      }
      return;
    }
  };

  const toggleFocus = (postitId: string | null) => {
    if (isFacilitator) {
      socket?.emit('postit:focus', { roomId: room.id, postitId });
    }
  };

  const handleFocusedEdit = (content: string) => {
    if (!focusedPostIt) return;
    socket?.emit('postit:update', { roomId: room.id, postitId: focusedPostIt.id, content });
  };

  // Drag and Drop logic
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, postitId: string) => {
    setDraggedId(postitId);
    e.dataTransfer.setData('postitId', postitId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropToColumn = (e: React.DragEvent<HTMLDivElement>, columnId: string) => {
    e.preventDefault();
    const postitId = e.dataTransfer.getData('postitId');
    socket?.emit('postit:move', { roomId: room.id, postitId, columnId });
    setDraggedId(null);
  };

  const handleDropToGroup = (e: React.DragEvent<HTMLDivElement>, groupId: string | null) => {
    e.preventDefault();
    const postitId = e.dataTransfer.getData('postitId');
    socket?.emit('postit:group', { roomId: room.id, postitId, groupId });
    setDraggedId(null);
  };

  // Vote management
  const handleGroupVote = (groupId: string) => {
    if (!userId) return;
    socket?.emit('group:vote', { roomId: room.id, groupId, odlUserId: userId });
  };

  const handleGroupUnvote = (groupId: string) => {
    if (!userId) return;
    socket?.emit('group:unvote', { roomId: room.id, groupId, odlUserId: userId });
  };

  const myVotes = room.groups.reduce((acc, g) => acc + (g.votes?.filter(id => id === userId).length || 0), 0);
  const totalVotesCast = room.groups.reduce((acc, g) => acc + (g.votes?.length || 0), 0);
  const totalExpectedVotes = room.participants.length * 3;
  const areVotesRevealed = totalVotesCast >= totalExpectedVotes && totalExpectedVotes > 0;

  // Check for tie
  const maxVotes = Math.max(...room.groups.map(g => g.votes?.length || 0));
  const tiedGroupsCount = room.groups.filter(g => (g.votes?.length || 0) === maxVotes).length;
  const hasTie = maxVotes > 0 && tiedGroupsCount > 1;

  const handleResetTie = () => {
    if (confirm(t.board.confirmTieBreak)) {
      socket?.emit('vote:reset_tie', { roomId: room.id });
    }
  };

  // Theme management actions
  const handleCreateGroup = () => {
    if (!newTopicTitle.trim()) return;
    socket?.emit('group:create', { roomId: room.id, title: newTopicTitle });
    setNewTopicTitle('');
  };

  const handleUpdateGroup = (groupId: string) => {
    if (!editTopicTitle.trim()) {
      setEditingTopicId(null);
      return;
    }
    socket?.emit('group:update', { roomId: room.id, groupId: groupId, title: editTopicTitle });
    setEditingTopicId(null);
  };

  const handleDeleteGroup = (groupId: string) => {
    if (confirm(t.board.deleteTopic)) {
      socket?.emit('group:delete', { roomId: room.id, groupId });
    }
  };

  // Action Items actions
  const handleAddAction = (groupId: string) => {
    const content = newActionContent[groupId];
    const ownerName = newActionOwner[groupId] || 'Équipe';
    if (!content?.trim()) return;

    socket?.emit('action:create', { roomId: room.id, content, ownerName, groupId });

    setNewActionContent({ ...newActionContent, [groupId]: '' });
  };

  const handleToggleAction = (action: ActionItem) => {
    socket?.emit('action:update', {
      roomId: room.id,
      actionId: action.id,
      updates: { status: action.status === 'DONE' ? 'TODO' : 'DONE' }
    });
  };

  const handleDeleteAction = (actionId: string) => {
    socket?.emit('action:delete', { roomId: room.id, actionId });
  };

  // Group focus/complete handlers (for ACTIONS phase)
  const handleFocusGroup = (groupId: string) => {
    if (!isFacilitator || !userId) return;
    socket?.emit('group:focus', { roomId: room.id, groupId, odlUserId: userId });
  };

  const handleCompleteGroup = (groupId: string) => {
    if (!isFacilitator || !userId) return;
    socket?.emit('group:complete', { roomId: room.id, groupId, odlUserId: userId });
  };

  // Get sorted groups by votes for ACTIONS phase
  const sortedGroups = [...room.groups].sort((a, b) => (b.votes?.length || 0) - (a.votes?.length || 0));
  const focusedGroup = room.groups.find(g => g.id === room.focusedGroupId);
  const pendingGroups = sortedGroups.filter(g => g.status === 'PENDING');
  const doneGroups = sortedGroups.filter(g => g.status === 'DONE');

  // Check if we should use the Thematic grouping view
  // Persistent for GROUPING, VOTING, ACTIONS, CONCLUSION
  const isThematicPhase = ['GROUPING', 'VOTING', 'ACTIONS', 'CONCLUSION'].includes(room.phase);

  if (isThematicPhase) {
    const unassignedPostIts = room.postits.filter(p => !p.groupId);

    return (
      <>
      <PhaseTutorial phase={room.phase} />
      <div className={`grouping-container ${room.phase === 'GROUPING' ? 'with-sidebar' : ''} ${room.phase === 'CONCLUSION' ? 'conclusion-layout' : ''}`}>
        {room.phase === 'GROUPING' && (
          <div className="grouping-sidebar glass">
            <div className="sidebar-header">
              <h3>{t.board.toSort}</h3>
              <span className="count-badge">{unassignedPostIts.length}</span>
            </div>
            <div
              className="sidebar-content drop-target"
              onDragOver={handleDragOver}
              onDrop={(e: React.DragEvent<HTMLDivElement>) => handleDropToGroup(e, null)}
            >
              {unassignedPostIts.map(p => (
                <div
                  key={p.id}
                  className={`postit-item small ${draggedId === p.id ? 'dragging' : ''}`}
                  style={{ backgroundColor: p.color }}
                  draggable
                  onDragStart={(e: React.DragEvent<HTMLDivElement>) => handleDragStart(e, p.id)}
                  onDragEnd={() => setDraggedId(null)}
                >
                  <div className="postit-content">{p.content}</div>
                  <div className="postit-mini-footer">
                    <span className="author">@{p.authorName}</span>
                  </div>
                </div>
              ))
              }
              {unassignedPostIts.length === 0 && (
                <div className="empty-sidebar">{t.board.allSorted}</div>
              )}
            </div>
          </div>
        )}

        <div className={`grouping-main ${room.phase !== 'GROUPING' ? 'full-width' : ''} ${room.phase === 'CONCLUSION' ? 'conclusion-full' : ''}`}>
          {room.phase === 'VOTING' && (
            <div className="voting-status-bar glass">
              <div className="vote-remaining">
                <strong>{3 - myVotes}</strong> {t.board.votesRemaining}
              </div>
              {!areVotesRevealed ? (
                <div className="voting-progress">
                  {t.board.waitingForVotes} ({totalVotesCast}/{totalExpectedVotes} {t.board.votes})
                </div>
              ) : (
                <div className="voting-revealed">
                  {t.board.resultsRevealed}
                  {hasTie && isFacilitator && (
                    <button className="btn-tie-break" onClick={handleResetTie}>
                      {t.board.breakTie}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          {room.phase === 'GROUPING' && (
            <div className="topic-creator glass">
              <input
                type="text"
                placeholder={t.board.topicName}
                value={newTopicTitle}
                onChange={(e) => setNewTopicTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
              />
              <button className="btn-primary" onClick={handleCreateGroup}>{t.board.createTopic}</button>
            </div>
          )}

          {room.phase === 'CONCLUSION' ? (
            /* CONCLUSION / SUMMARY VIEW */
            <div className="summary-container">
              {/* Header with Export Button */}
              <div className="summary-header-row">
                <div className="summary-stats">
                  <div className="stat-card">
                    <div className="stat-number">{room.participants.length}</div>
                    <div className="stat-label">Participants</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-number">{room.postits.length}</div>
                    <div className="stat-label">Ideas shared</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-number">{room.groups.length}</div>
                    <div className="stat-label">Topics identified</div>
                  </div>
                  <div className="stat-card accent">
                    <div className="stat-number">{room.actionItems.length}</div>
                    <div className="stat-label">Action items</div>
                  </div>
                </div>
                <button 
                  className="btn-export-pdf"
                  onClick={() => exportToPDF({
                    room,
                    translations: {
                      title: room.name,
                      participants: 'Participants',
                      ideas: 'Ideas',
                      topics: 'Topics',
                      actionItems: 'Action Items',
                      votes: 'votes',
                      assignee: t.actions.assignee,
                      team: t.actions.team,
                      generatedOn: t.export.generatedOn,
                      topicsPriority: t.export.topicsPriority,
                      noActions: t.export.noActions,
                    }
                  })}
                >
                  <span className="pdf-icon">📄</span>
                  {t.export.exportPDF}
                </button>
              </div>

              {/* Action Items Summary */}
              {room.actionItems.length > 0 && (
                <div className="summary-section">
                  <h3 className="section-title">Action Items</h3>
                  <div className="actions-summary">
                    {room.actionItems.map(a => {
                      const topic = room.groups.find(g => g.id === a.groupId);
                      return (
                        <div key={a.id} className={`action-summary-row ${a.status === 'DONE' ? 'done' : ''}`}>
                          <div className="action-checkbox">{a.status === 'DONE' ? '✓' : '○'}</div>
                          <div className="action-details">
                            <div className="action-content">{a.content}</div>
                            {topic && <div className="action-topic">from: {topic.title}</div>}
                          </div>
                          <div className="action-assignee">
                            <span className="assignee-avatar">{(a.ownerName || 'Team')[0].toUpperCase()}</span>
                            <span className="assignee-name">{a.ownerName || t.actions.team}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Topics by Priority */}
              <div className="summary-section">
                <h3 className="section-title">Topics by Priority</h3>
                <div className="topics-summary">
                  {[...room.groups]
                    .sort((a, b) => b.votes.length - a.votes.length)
                    .map((group, index) => {
                      const groupPostits = room.postits.filter(p => p.groupId === group.id);
                      const groupActions = room.actionItems.filter(a => a.groupId === group.id);
                      return (
                        <div key={group.id} className="topic-summary-card">
                          <div className="topic-rank">#{index + 1}</div>
                          <div className="topic-main">
                            <div className="topic-summary-header">
                              <h4>{group.title}</h4>
                              <div className="topic-badges">
                                <span className="badge votes">{group.votes.length} votes</span>
                                <span className="badge ideas">{groupPostits.length} ideas</span>
                                {groupActions.length > 0 && (
                                  <span className="badge actions">{groupActions.length} actions</span>
                                )}
                              </div>
                            </div>
                            <div className="topic-ideas-preview">
                              {groupPostits.slice(0, 3).map(p => (
                                <div key={p.id} className="idea-chip" style={{ backgroundColor: p.color }}>
                                  {p.content.length > 40 ? p.content.substring(0, 40) + '...' : p.content}
                                </div>
                              ))}
                              {groupPostits.length > 3 && (
                                <span className="more-ideas">+{groupPostits.length - 3} more</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Participants */}
              <div className="summary-section">
                <h3 className="section-title">Participants</h3>
                <div className="participants-summary">
                  {room.participants.map(p => (
                    <div key={p.id} className="participant-chip">
                      <span className="participant-avatar">{p.name[0].toUpperCase()}</span>
                      <span className="participant-name">{p.name}</span>
                      {p.role === 'FACILITATOR' && <span className="facilitator-badge">Facilitator</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : room.phase === 'ACTIONS' ? (
            /* ACTIONS PHASE - Full screen topic focus */
            <div className="actions-phase-container">
              {focusedGroup ? (
                <>
                  {/* Main focused topic area */}
                  <div className="focused-topic-card">
                    <div className="focused-topic-header">
                      <div className="topic-info">
                        <span className="topic-rank-badge">#{sortedGroups.findIndex(g => g.id === focusedGroup.id) + 1}</span>
                        <h2>{focusedGroup.title}</h2>
                        <span className="votes-badge">{focusedGroup.votes?.length || 0} votes</span>
                      </div>
                      <div className="topic-progress">
                        <span className="done-count">{doneGroups.length} done</span>
                        <span className="separator">/</span>
                        <span className="total-count">{room.groups.length} topics</span>
                      </div>
                    </div>

                    {/* Post-its for this topic */}
                    <div className="focused-topic-postits">
                      <h4>{t.board.ideasForTopic}</h4>
                      <div className="postits-grid">
                        {room.postits
                          .filter(p => p.groupId === focusedGroup.id)
                          .map(p => (
                            <div 
                              key={p.id} 
                              className="postit-mini-card"
                              style={{ backgroundColor: p.color }}
                            >
                              <div className="postit-text">{p.content}</div>
                              <div className="postit-author">@{p.authorName}</div>
                            </div>
                          ))}
                      </div>
                    </div>

                    {/* Actions section */}
                    <div className="focused-topic-actions">
                      <h4>{t.actions.linkedActions}</h4>
                      <div className="actions-list-focused">
                        {room.actionItems
                          .filter(a => a.groupId === focusedGroup.id)
                          .map(a => (
                            <div key={a.id} className={`action-item-row ${a.status === 'DONE' ? 'done' : ''}`}>
                              <input
                                type="checkbox"
                                checked={a.status === 'DONE'}
                                onChange={() => handleToggleAction(a)}
                              />
                              <span className="action-text">{a.content}</span>
                              <span className="action-owner">@{a.ownerName || t.actions.team}</span>
                              {isFacilitator && (
                                <button className="btn-del" onClick={() => handleDeleteAction(a.id)}>×</button>
                              )}
                            </div>
                          ))}
                      </div>

                      {/* Add action form */}
                      <div className="add-action-form">
                        <input
                          type="text"
                          placeholder={t.actions.newAction}
                          value={newActionContent[focusedGroup.id] || ''}
                          onChange={(e) => setNewActionContent({ ...newActionContent, [focusedGroup.id]: e.target.value })}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddAction(focusedGroup.id)}
                        />
                        <select
                          value={newActionOwner[focusedGroup.id] || t.actions.team}
                          onChange={(e) => setNewActionOwner({ ...newActionOwner, [focusedGroup.id]: e.target.value })}
                        >
                          <option value={t.actions.team}>{t.actions.team}</option>
                          {room.participants.map(p => (
                            <option key={p.id} value={p.name}>{p.name}</option>
                          ))}
                        </select>
                        <button className="btn-add-action" onClick={() => handleAddAction(focusedGroup.id)}>
                          {t.actions.add}
                        </button>
                      </div>
                    </div>

                    {/* Navigation buttons */}
                    {isFacilitator && (
                      <div className="topic-navigation">
                        <button 
                          className="btn-complete-topic"
                          onClick={() => handleCompleteGroup(focusedGroup.id)}
                        >
                          {pendingGroups.length > 0 ? t.actions.completeAndNext : t.actions.completeTopic}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Topics sidebar - remaining topics */}
                  <div className="topics-sidebar">
                    {pendingGroups.length > 0 && (
                      <div className="sidebar-section">
                        <h5>{t.actions.upNext}</h5>
                        {pendingGroups.map((g, idx) => (
                          <div 
                            key={g.id} 
                            className={`sidebar-topic-item ${isFacilitator ? 'clickable' : ''}`}
                            onClick={() => isFacilitator && handleFocusGroup(g.id)}
                          >
                            <span className="topic-order">{idx + 1}</span>
                            <span className="topic-name">{g.title}</span>
                            <span className="topic-votes">{g.votes?.length || 0}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {doneGroups.length > 0 && (
                      <div className="sidebar-section done-section">
                        <h5>{t.actions.completed}</h5>
                        {doneGroups.map(g => (
                          <div 
                            key={g.id} 
                            className={`sidebar-topic-item done ${isFacilitator ? 'clickable' : ''}`}
                            onClick={() => isFacilitator && handleFocusGroup(g.id)}
                          >
                            <span className="check-icon">✓</span>
                            <span className="topic-name">{g.title}</span>
                            <span className="action-count">{room.actionItems.filter(a => a.groupId === g.id).length}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* No focused group - show completion message or list */
                <div className="all-topics-done">
                  <div className="done-message">
                    <span className="done-icon">✓</span>
                    <h2>{t.actions.allTopicsCompleted}</h2>
                    <p>{t.actions.totalActions}: {room.actionItems.length}</p>
                  </div>
                  {isFacilitator && doneGroups.length > 0 && (
                    <div className="review-topics">
                      <h4>{t.actions.reviewTopics}</h4>
                      <div className="topics-review-grid">
                        {doneGroups.map(g => (
                          <div 
                            key={g.id} 
                            className="review-topic-card clickable"
                            onClick={() => handleFocusGroup(g.id)}
                          >
                            <h5>{g.title}</h5>
                            <span>{room.actionItems.filter(a => a.groupId === g.id).length} actions</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* OTHER THEMATIC PHASES (GROUPING, VOTING) */
            <>
          <div className={`topics-grid`}>
            {room.groups.map((group: Group) => (
              <div
                key={group.id}
                className={`topic-card glass`}
                onDragOver={handleDragOver}
                onDrop={(e: React.DragEvent<HTMLDivElement>) => handleDropToGroup(e, group.id)}
              >
                <div className="topic-header">
                  {editingTopicId === group.id ? (
                    <input
                      autoFocus
                      className="edit-topic-input"
                      value={editTopicTitle}
                      onChange={(e) => setEditTopicTitle(e.target.value)}
                      onBlur={() => handleUpdateGroup(group.id)}
                      onKeyDown={(e) => e.key === 'Enter' && handleUpdateGroup(group.id)}
                    />
                  ) : (
                    <div className="topic-title-row">
                      <h4 onClick={() => {
                        if (isFacilitator && room.phase === 'GROUPING') {
                          setEditingTopicId(group.id);
                          setEditTopicTitle(group.title);
                        }
                      }}>
                        {group.title}
                      </h4>
                      {room.phase === 'VOTING' && (
                        <div className="topic-voting-controls">
                          <button className="btn-vote" onClick={() => handleGroupVote(group.id)} disabled={myVotes >= 3}>+</button>
                          <button className="btn-unvote" onClick={() => handleGroupUnvote(group.id)}>-</button>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="topic-header-actions">
                    {areVotesRevealed && (
                      <div className="topic-vote-count">
                        {group.votes.length} votes
                      </div>
                    )}
                    {isFacilitator && room.phase === 'GROUPING' && (
                      <button className="btn-delete-topic" onClick={() => handleDeleteGroup(group.id)}>✕</button>
                    )}
                  </div>
                </div>

                <div className="topic-content">
                  <div className="topic-postits">
                    {room.postits
                      .filter(p => p.groupId === group.id)
                      .map(p => (
                        <div
                          key={p.id}
                          className={`postit-item mini ${draggedId === p.id ? 'dragging' : ''} ${room.phase === 'VOTING' ? 'votable' : ''}`}
                          style={{ backgroundColor: p.color }}
                          draggable={room.phase === 'GROUPING'}
                          onDragStart={(e: React.DragEvent<HTMLDivElement>) => handleDragStart(e, p.id)}
                          onDragEnd={() => setDraggedId(null)}
                          onClick={() => handlePostItClick(p)}
                        >
                          <div className="mini-content">{p.content}</div>
                          <div className="postit-mini-footer">
                            <span className="author">@{p.authorName}</span>
                            {room.phase !== 'GROUPING' && p.votes.length > 0 && (
                              <div className="mini-votes">
                                {p.votes.map(v => <span key={v} className="dot">●</span>)}
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    }
                  </div>

                  {/* Action Items Section */}
                  {room.phase === 'ACTIONS' && (
                    <div className="topic-actions">
                      <h5>{t.actions.linkedActions}</h5>
                      <div className="actions-list">
                        {room.actionItems
                          .filter(a => a.groupId === group.id)
                          .map(a => (
                            <div key={a.id} className={`action-row ${a.status === 'DONE' ? 'done' : ''}`}>
                              <input
                                type="checkbox"
                                checked={a.status === 'DONE'}
                                onChange={() => handleToggleAction(a)}
                              />
                              <span className="action-text">{a.content}</span>
                              <span className="action-owner">@{a.ownerName || t.actions.team}</span>
                              {isFacilitator && (
                                <button className="btn-del-action" onClick={() => handleDeleteAction(a.id)}>×</button>
                              )}
                            </div>
                          ))
                        }
                      </div>

                      {isFacilitator && (
                        <div className="action-input-row">
                          <input
                            type="text"
                            placeholder={t.actions.newAction}
                            value={newActionContent[group.id] || ''}
                            onChange={(e) => setNewActionContent({ ...newActionContent, [group.id]: e.target.value })}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddAction(group.id)}
                          />
                          <select
                            value={newActionOwner[group.id] || t.actions.team}
                            onChange={(e) => setNewActionOwner({ ...newActionOwner, [group.id]: e.target.value })}
                          >
                            <option value={t.actions.team}>{t.actions.team}</option>
                            {room.participants.map(p => (
                              <option key={p.id} value={p.name}>{p.name}</option>
                            ))}
                          </select>
                          <button onClick={() => handleAddAction(group.id)}>+</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
            </>
          )}
        </div>

        <style>{`
          .grouping-container {
            display: flex;
            position: relative;
            gap: 1.5rem;
            height: 100%;
            padding: 1.5rem;
            overflow: hidden;
            box-sizing: border-box;
          }
          .grouping-container.with-sidebar {
            display: grid;
            grid-template-columns: 320px 1fr;
          }
          .grouping-container.conclusion-layout {
            height: auto;
            overflow: visible;
          }
          .grouping-main { 
            display: flex; 
            flex-direction: column; 
            gap: 1.5rem; 
            height: 100%; 
            overflow: hidden;
            min-width: 0;
            flex: 1;
          }
          .grouping-main.full-width {
            width: 100%;
          }
          .grouping-main.conclusion-full { 
            padding: 2rem; 
            overflow-y: auto;
            height: 100%;
          }

          .grouping-sidebar {
            display: flex;
            flex-direction: column;
            border-radius: 12px;
            overflow: hidden;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.05);
            height: 100%;
          }
          .sidebar-header {
            padding: 1.5rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            display: flex; justify-content: space-between; align-items: center;
            background: rgba(0,0,0,0.1);
            flex-shrink: 0;
          }
          .sidebar-header h3 { margin: 0; font-size: 0.9rem; text-transform: uppercase; color: var(--text-secondary); }
          .count-badge {
            background: var(--accent-color); color: white;
            padding: 2px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: bold;
          }
          .sidebar-content {
            flex: 1; padding: 1.5rem; overflow-y: auto;
            display: flex; flex-direction: column; gap: 1rem;
          }
          .empty-sidebar { text-align: center; color: rgba(255, 255, 255, 0.2); margin-top: 2rem; font-style: italic; }


          .topic-creator {
            padding: 1rem; border-radius: 12px; display: flex; gap: 1rem;
            background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1);
            flex-shrink: 0;
          }
          .topic-creator input {
            flex: 1; background: rgba(0,0,0,0.2); border: 1px solid rgba(255, 255, 255, 0.1);
            color: white; padding: 0.8rem 1.2rem; border-radius: 8px; outline: none; transition: border-color 0.2s;
          }
          .topic-creator input:focus { border-color: var(--accent-color); }

          .topics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
            gap: 1.5rem; 
            overflow-y: auto; 
            padding-bottom: 2rem;
            flex: 1;
            align-content: start;
          }
          .topics-grid.conclusion-view {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 1.5rem;
          }
          .topic-card.conclusion-card {
            min-height: auto;
            border-left: 5px solid var(--accent-color);
          }
          .topic-actions.recap {
            background: rgba(var(--accent-color-rgb), 0.1);
            border: none;
          }
          .no-actions { font-style: italic; opacity: 0.5; font-size: 0.9rem; padding: 0.5rem; }
          
          /* SUMMARY / CONCLUSION STYLES */
          .summary-container {
            display: flex;
            flex-direction: column;
            gap: 2rem;
            max-width: 1200px;
            width: 100%;
            margin: 0 auto;
            padding-bottom: 2rem;
          }
          
          .summary-header-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 1.5rem;
            flex-wrap: wrap;
          }
          .summary-stats {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 1rem;
            flex: 1;
            min-width: 400px;
          }
          .stat-card {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 1.5rem;
            text-align: center;
          }
          .stat-card.accent {
            background: var(--accent-color);
            border-color: var(--accent-color);
          }
          .stat-number {
            font-size: 2.5rem;
            font-weight: 700;
            line-height: 1;
            margin-bottom: 0.5rem;
          }
          .stat-label {
            font-size: 0.85rem;
            opacity: 0.7;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .btn-export-pdf {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            background: linear-gradient(135deg, #e74c3c, #c0392b);
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 10px;
            font-size: 0.95rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 4px 15px rgba(231, 76, 60, 0.3);
            white-space: nowrap;
          }
          .btn-export-pdf:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(231, 76, 60, 0.4);
          }
          .btn-export-pdf:active {
            transform: translateY(0);
          }
          .pdf-icon {
            font-size: 1.1rem;
          }
          
          .summary-section {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 16px;
            padding: 1.5rem;
          }
          .section-title {
            margin: 0 0 1.5rem 0;
            font-size: 1.1rem;
            font-weight: 600;
            color: var(--accent-color);
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }
          .section-title::before {
            content: '';
            width: 4px;
            height: 20px;
            background: var(--accent-color);
            border-radius: 2px;
          }
          
          /* Actions Summary */
          .actions-summary {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
          }
          .action-summary-row {
            display: flex;
            align-items: center;
            gap: 1rem;
            padding: 1rem;
            background: rgba(255, 255, 255, 0.03);
            border-radius: 8px;
            border-left: 3px solid var(--accent-color);
          }
          .action-summary-row.done {
            opacity: 0.6;
            border-left-color: var(--retro-green);
          }
          .action-summary-row.done .action-content {
            text-decoration: line-through;
          }
          .action-checkbox {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.1);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.8rem;
            flex-shrink: 0;
          }
          .action-summary-row.done .action-checkbox {
            background: var(--retro-green);
            color: white;
          }
          .action-details {
            flex: 1;
          }
          .action-content {
            font-size: 1rem;
            margin-bottom: 0.25rem;
          }
          .action-topic {
            font-size: 0.75rem;
            opacity: 0.5;
          }
          .action-assignee {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.4rem 0.8rem;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
          }
          .assignee-avatar {
            width: 24px;
            height: 24px;
            background: var(--accent-color);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.75rem;
            font-weight: 600;
          }
          .assignee-name {
            font-size: 0.85rem;
            font-weight: 500;
          }
          
          /* Topics Summary */
          .topics-summary {
            display: flex;
            flex-direction: column;
            gap: 1rem;
          }
          .topic-summary-card {
            display: flex;
            gap: 1rem;
            padding: 1rem;
            background: rgba(255, 255, 255, 0.02);
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.05);
          }
          .topic-rank {
            width: 40px;
            height: 40px;
            background: var(--accent-color);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 1rem;
            flex-shrink: 0;
          }
          .topic-main {
            flex: 1;
            min-width: 0;
          }
          .topic-summary-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 0.75rem;
            flex-wrap: wrap;
            gap: 0.5rem;
          }
          .topic-summary-header h4 {
            margin: 0;
            font-size: 1.1rem;
          }
          .topic-badges {
            display: flex;
            gap: 0.5rem;
            flex-wrap: wrap;
          }
          .badge {
            padding: 0.2rem 0.6rem;
            border-radius: 12px;
            font-size: 0.7rem;
            font-weight: 600;
            text-transform: uppercase;
          }
          .badge.votes {
            background: rgba(47, 129, 247, 0.2);
            color: var(--accent-color);
          }
          .badge.ideas {
            background: rgba(255, 255, 255, 0.1);
            color: var(--text-secondary);
          }
          .badge.actions {
            background: rgba(63, 185, 80, 0.2);
            color: var(--retro-green);
          }
          .topic-ideas-preview {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
            align-items: center;
          }
          .idea-chip {
            padding: 0.3rem 0.6rem;
            border-radius: 4px;
            font-size: 0.8rem;
            color: #000;
            max-width: 200px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .more-ideas {
            font-size: 0.8rem;
            opacity: 0.5;
            font-style: italic;
          }
          
          /* Participants Summary */
          .participants-summary {
            display: flex;
            flex-wrap: wrap;
            gap: 0.75rem;
          }
          .participant-chip {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 24px;
            border: 1px solid rgba(255, 255, 255, 0.1);
          }
          .participant-avatar {
            width: 28px;
            height: 28px;
            background: linear-gradient(135deg, var(--accent-color), #9c27b0);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.8rem;
            font-weight: 600;
          }
          .participant-name {
            font-size: 0.9rem;
          }
          .facilitator-badge {
            font-size: 0.65rem;
            padding: 0.15rem 0.4rem;
            background: var(--accent-color);
            border-radius: 4px;
            text-transform: uppercase;
          }

          /* ACTIONS PHASE - Full screen topic focus */
          .actions-phase-container {
            display: grid;
            grid-template-columns: 1fr 280px;
            gap: 1.5rem;
            height: 100%;
            overflow: hidden;
          }

          .focused-topic-card {
            display: flex;
            flex-direction: column;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 16px;
            overflow: hidden;
          }

          .focused-topic-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1.5rem 2rem;
            background: linear-gradient(135deg, rgba(47, 129, 247, 0.15), rgba(47, 129, 247, 0.05));
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          }

          .topic-info {
            display: flex;
            align-items: center;
            gap: 1rem;
          }

          .topic-rank-badge {
            background: var(--accent-color);
            color: white;
            padding: 0.4rem 0.8rem;
            border-radius: 8px;
            font-weight: 700;
            font-size: 0.9rem;
          }

          .focused-topic-header h2 {
            margin: 0;
            font-size: 1.5rem;
            font-weight: 600;
          }

          .votes-badge {
            background: rgba(255, 255, 255, 0.1);
            padding: 0.3rem 0.8rem;
            border-radius: 20px;
            font-size: 0.85rem;
            color: var(--text-secondary);
          }

          .topic-progress {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.9rem;
            color: var(--text-secondary);
          }

          .done-count {
            color: var(--retro-green);
            font-weight: 600;
          }

          .separator {
            opacity: 0.5;
          }

          .focused-topic-postits {
            padding: 1.5rem 2rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          }

          .focused-topic-postits h4,
          .focused-topic-actions h4 {
            margin: 0 0 1rem 0;
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--text-secondary);
          }

          .postits-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 0.75rem;
          }

          .postit-mini-card {
            padding: 0.75rem 1rem;
            border-radius: 6px;
            color: #000;
            font-size: 0.9rem;
            font-weight: 500;
            box-shadow: 2px 2px 8px rgba(0,0,0,0.15);
            max-width: 250px;
          }

          .postit-mini-card .postit-text {
            margin-bottom: 0.5rem;
            line-height: 1.3;
          }

          .postit-mini-card .postit-author {
            font-size: 0.7rem;
            opacity: 0.6;
            font-style: italic;
          }

          .focused-topic-actions {
            flex: 1;
            padding: 1.5rem 2rem;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
          }

          .actions-list-focused {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            margin-bottom: 1rem;
            flex: 1;
            overflow-y: auto;
          }

          .action-item-row {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.75rem 1rem;
            background: rgba(255, 255, 255, 0.03);
            border-radius: 8px;
            border-left: 3px solid var(--accent-color);
          }

          .action-item-row.done {
            opacity: 0.6;
            border-left-color: var(--retro-green);
          }

          .action-item-row.done .action-text {
            text-decoration: line-through;
          }

          .action-item-row input[type="checkbox"] {
            width: 18px;
            height: 18px;
            cursor: pointer;
          }

          .action-item-row .action-text {
            flex: 1;
            font-size: 0.95rem;
          }

          .action-item-row .action-owner {
            font-size: 0.8rem;
            color: var(--accent-color);
            font-weight: 600;
          }

          .action-item-row .btn-del {
            background: transparent;
            border: none;
            color: rgba(255, 255, 255, 0.3);
            cursor: pointer;
            font-size: 1.2rem;
            padding: 0 0.3rem;
          }

          .action-item-row .btn-del:hover {
            color: #f44336;
          }

          .add-action-form {
            display: flex;
            gap: 0.75rem;
            margin-top: auto;
            padding-top: 1rem;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
          }

          .add-action-form input {
            flex: 1;
            background: rgba(0, 0, 0, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: white;
            padding: 0.75rem 1rem;
            border-radius: 8px;
            font-size: 0.9rem;
          }

          .add-action-form input:focus {
            outline: none;
            border-color: var(--accent-color);
          }

          .add-action-form select {
            background: rgba(0, 0, 0, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 8px;
            font-size: 0.85rem;
            min-width: 120px;
          }

          .btn-add-action {
            background: var(--accent-color);
            border: none;
            color: white;
            padding: 0.75rem 1.5rem;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s;
          }

          .btn-add-action:hover {
            background: #1a6dd4;
          }

          .topic-navigation {
            padding: 1.5rem 2rem;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
            justify-content: flex-end;
            gap: 1rem;
          }

          .btn-complete-topic {
            background: var(--retro-green);
            border: none;
            color: white;
            padding: 0.75rem 2rem;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }

          .btn-complete-topic:hover {
            background: #2ea043;
            transform: translateY(-1px);
          }

          /* Topics sidebar */
          .topics-sidebar {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
            overflow-y: auto;
            padding-right: 0.5rem;
          }

          .sidebar-section h5 {
            margin: 0 0 0.75rem 0;
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--text-secondary);
          }

          .sidebar-topic-item {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.75rem 1rem;
            background: rgba(255, 255, 255, 0.03);
            border-radius: 8px;
            margin-bottom: 0.5rem;
            border-left: 3px solid transparent;
          }

          .sidebar-topic-item.clickable {
            cursor: pointer;
            transition: all 0.2s;
          }

          .sidebar-topic-item.clickable:hover {
            background: rgba(255, 255, 255, 0.08);
            border-left-color: var(--accent-color);
          }

          .sidebar-topic-item .topic-order {
            background: rgba(255, 255, 255, 0.1);
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.75rem;
            font-weight: 600;
            flex-shrink: 0;
          }

          .sidebar-topic-item .topic-name {
            flex: 1;
            font-size: 0.9rem;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .sidebar-topic-item .topic-votes {
            font-size: 0.75rem;
            color: var(--accent-color);
            font-weight: 600;
          }

          .sidebar-topic-item.done {
            opacity: 0.6;
          }

          .sidebar-topic-item .check-icon {
            color: var(--retro-green);
            font-weight: bold;
          }

          .sidebar-topic-item .action-count {
            font-size: 0.75rem;
            background: rgba(63, 185, 80, 0.2);
            color: var(--retro-green);
            padding: 0.15rem 0.5rem;
            border-radius: 10px;
          }

          .done-section {
            border-top: 1px solid rgba(255, 255, 255, 0.05);
            padding-top: 1rem;
          }

          /* All topics done state */
          .all-topics-done {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            text-align: center;
            grid-column: 1 / -1;
          }

          .done-message {
            margin-bottom: 2rem;
          }

          .done-message .done-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 80px;
            height: 80px;
            background: var(--retro-green);
            border-radius: 50%;
            font-size: 2.5rem;
            margin-bottom: 1rem;
          }

          .done-message h2 {
            margin: 0 0 0.5rem 0;
            font-size: 1.5rem;
          }

          .done-message p {
            margin: 0;
            color: var(--text-secondary);
          }

          .review-topics h4 {
            margin: 0 0 1rem 0;
            font-size: 0.9rem;
            color: var(--text-secondary);
          }

          .topics-review-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 1rem;
            justify-content: center;
          }

          .review-topic-card {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            padding: 1rem 1.5rem;
            text-align: center;
          }

          .review-topic-card.clickable {
            cursor: pointer;
            transition: all 0.2s;
          }

          .review-topic-card.clickable:hover {
            background: rgba(255, 255, 255, 0.08);
            border-color: var(--accent-color);
          }

          .review-topic-card h5 {
            margin: 0 0 0.5rem 0;
            font-size: 1rem;
          }

          .review-topic-card span {
            font-size: 0.85rem;
            color: var(--retro-green);
          }

          @media (max-width: 900px) {
            .actions-phase-container {
              grid-template-columns: 1fr;
            }
            .topics-sidebar {
              display: none;
            }
          }
          
          @media (max-width: 768px) {
            .summary-stats {
              grid-template-columns: repeat(2, 1fr);
            }
            .action-summary-row {
              flex-wrap: wrap;
            }
            .action-assignee {
              width: 100%;
              justify-content: center;
            }
            .topic-summary-header {
              flex-direction: column;
            }
          }
          .topic-card {
            border-radius: 12px; display: flex; flex-direction: column;
            background: rgba(255, 255, 255, 0.03); min-height: 250px;
            border: 1px solid rgba(255, 255, 255, 0.05); transition: transform 0.2s;
            overflow: hidden;
          }
          .topic-header {
            padding: 1rem 1.5rem; display: flex; justify-content: space-between; align-items: center;
            background: rgba(255, 255, 255, 0.02); border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          }
          .topic-header h4 { margin: 0; font-size: 1.1rem; color: var(--accent-color); }
          .btn-delete-topic { background: transparent; border: none; color: rgba(255, 255, 255, 0.2); cursor: pointer; }
          .btn-delete-topic:hover { color: #f44336; }

          .topic-content { padding: 1rem; display: flex; flex-direction: column; gap: 1.5rem; overflow: hidden; }
          .topic-postits { display: flex; flex-wrap: wrap; gap: 0.5rem; }
          
          .voting-status-bar {
            padding: 1rem 1.5rem; border-radius: 12px; display: flex; justify-content: space-between;
            align-items: center; background: var(--accent-color); color: white; margin-bottom: 1rem;
          }
          .voting-revealed { font-weight: bold; display: flex; align-items: center; gap: 1rem; }
          .btn-tie-break {
            background: white; color: var(--accent-color); border: none;
            padding: 0.3rem 0.8rem; border-radius: 20px; font-size: 0.8rem;
            font-weight: bold; cursor: pointer; animation: pulse 2s infinite;
          }
          .topic-title-row { display: flex; align-items: center; gap: 1rem; }
          .topic-voting-controls { display: flex; gap: 0.3rem; }
          .topic-voting-controls button {
            width: 24px; height: 24px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2);
            background: rgba(255,255,255,0.1); color: white; cursor: pointer; display: flex;
            align-items: center; justify-content: center; font-size: 1rem;
          }
          .topic-voting-controls button:hover:not(:disabled) { background: white; color: var(--accent-color); }
          .topic-vote-count {
            background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 12px;
            font-size: 0.8rem; font-weight: bold; color: var(--accent-color);
          }
          .topic-header-actions { display: flex; align-items: center; gap: 0.5rem; }
          
          .postit-item {
            padding: 0.8rem;
            border-radius: 4px;
            color: #000;
            font-weight: 500;
            line-height: 1.4;
            box-shadow: 2px 2px 8px rgba(0,0,0,0.2);
            position: relative;
            word-break: break-word;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .postit-item.small {
            min-height: 100px;
            font-size: 1rem;
            cursor: grab;
          }
          .postit-item.mini {
            min-height: 80px;
            padding: 0.6rem;
            font-size: 0.95rem;
            border-radius: 4px;
            color: #000;
            font-weight: 500;
            box-shadow: 1px 1px 3px rgba(0,0,0,0.1);
            cursor: grab;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            width: calc(50% - 0.5rem);
            flex: 0 0 auto;
          }
          .postit-mini-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 0.5rem;
            border-top: 1px solid rgba(0,0,0,0.05);
            padding-top: 0.3rem;
          }
          .postit-mini-footer .author {
            font-size: 0.7rem;
            color: rgba(0,0,0,0.4);
            font-style: italic;
          }
          .mini-votes { display: flex; gap: 2px; }
          .mini-votes .dot { font-size: 0.6rem; color: var(--accent-color); }

          /* Action Items Section */
          .topic-actions {
            background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.05);
            overflow: hidden; box-sizing: border-box;
          }
          .topic-actions h5 { margin: 0 0 1rem 0; font-size: 0.8rem; text-transform: uppercase; color: var(--text-secondary); opacity: 0.7; }
          .actions-list { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
          .action-row {
            display: flex; align-items: center; gap: 0.8rem; background: rgba(255,255,255,0.03);
            padding: 0.5rem 0.8rem; border-radius: 4px; font-size: 0.9rem;
          }
          .action-row.done { opacity: 0.5; text-decoration: line-through; }
          .action-text { flex: 1; }
          .action-owner { font-size: 0.75rem; color: var(--accent-color); font-weight: bold; }
          .btn-del-action { background: transparent; border: none; color: #f44336; cursor: pointer; padding: 0 5px; }

          .action-input-row { display: flex; gap: 0.5rem; flex-wrap: wrap; }
          .action-input-row input {
            flex: 1; min-width: 120px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1);
            color: white; padding: 0.4rem 0.8rem; border-radius: 4px; font-size: 0.85rem;
            box-sizing: border-box;
          }
          .action-input-row select {
            background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1);
            color: white; border-radius: 4px; padding: 0.2rem 0.4rem; font-size: 0.8rem;
            max-width: 120px; box-sizing: border-box;
          }
          .action-input-row button {
            background: var(--accent-color); border: none; color: white;
            border-radius: 4px; width: 30px; min-width: 30px; cursor: pointer; flex-shrink: 0;
          }
        `}</style>
      </div>
      </>
    );
  }

  // RENDER: Default Phase View (Board columns for SETUP, IDEATION, DISCUSSION)
  return (
    <>
    <PhaseTutorial phase={room.phase} />
    <div className="board-grid">
      {room.columns.map((column: Column) => (
        <div
          key={column.id}
          className="board-column glass"
          onDragOver={handleDragOver}
          onDrop={(e: React.DragEvent<HTMLDivElement>) => handleDropToColumn(e, column.id)}
        >
          <div className="column-header" style={{ borderTopColor: column.color }}>
            <h3>{column.title}</h3>
            <button className="btn-add" onClick={() => setIsAddingTo(column.id)}>+</button>
          </div>
          <div className="column-content">
            {isAddingTo === column.id && (
              <div className="postit-item adding">
                <textarea
                  autoFocus
                  value={newContent}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewContent(e.target.value)}
                  onBlur={handleAddPostIt}
                  onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && !e.shiftKey && handleAddPostIt()}
                  placeholder={t.board.writeIdea}
                />
              </div>
            )}
            {room.postits
              .filter((p: PostIt) => p.columnId === column.id)
              .map((p: PostIt) => {
                const isStealth = (room.phase === 'IDEATION' || room.phase === 'SETUP') && p.authorId !== userId;
                const hasVoted = userId ? p.votes.includes(userId) : false;
                const isEditing = editingId === p.id;
                const isAuthor = p.authorId === userId;
                const canEdit = isAuthor || isFacilitator;

                if (isEditing) {
                  return (
                    <div key={p.id} className="postit-item adding editing" style={{ backgroundColor: p.color }}>
                      <textarea
                        autoFocus
                        value={editContent}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditContent(e.target.value)}
                        onBlur={() => handleUpdatePostIt(p.id)}
                        onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && !e.shiftKey && handleUpdatePostIt(p.id)}
                      />
                    </div>
                  );
                }

                return (
                  <div
                    key={p.id}
                    className={`postit-item ${isStealth ? 'stealth' : ''} ${room.phase === 'VOTING' ? 'votable' : ''} ${hasVoted ? 'voted' : ''} ${((room.phase === 'IDEATION' || room.phase === 'SETUP') && isAuthor) || (room.phase === 'DISCUSSION' && canEdit) ? 'clickable' : ''} ${draggedId === p.id ? 'dragging' : ''}`}
                    style={{ backgroundColor: p.color }}
                    onClick={() => handlePostItClick(p)}
                    draggable={room.phase !== 'IDEATION' && room.phase !== 'SETUP'}
                    onDragStart={(e: React.DragEvent<HTMLDivElement>) => handleDragStart(e, p.id)}
                    onDragEnd={() => setDraggedId(null)}
                  >
                    <div className="postit-content">
                      {isStealth ? (
                        <div className="stealth-placeholder">
                          <span>🔒</span>
                          <span className="stealth-text">{t.board.hiddenIdea}</span>
                        </div>
                      ) : (
                        p.content
                      )}
                    </div>
                    <div className="postit-footer">
                      <div className="author-tag">
                        <span className="postit-author">@{p.authorName}</span>
                      </div>

                      <div className="postit-actions">
                        {room.phase === 'DISCUSSION' && isFacilitator && (
                          <button
                            className="btn-focus-trigger"
                            onClick={(e) => { e.stopPropagation(); toggleFocus(p.id); }}
                            title="Agrandir pour tous"
                          >
                            ⤢
                          </button>
                        )}
                        {(room.phase !== 'IDEATION' && room.phase !== 'SETUP') && p.votes.length > 0 && (
                          <div className="postit-votes">
                            {p.votes.map((v: string) => <span key={v} className="vote-dot">●</span>)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            }
          </div>
        </div>
      ))}

      {focusedPostIt && (
        <div className="focus-overlay" onClick={() => toggleFocus(null)}>
          <div className="focused-postit" style={{ backgroundColor: focusedPostIt.color }} onClick={e => e.stopPropagation()}>
            {isFacilitator && <button className="btn-close-focus" onClick={() => toggleFocus(null)}>✕</button>}
            <div className="focused-content">
              {(focusedPostIt.authorId === userId || isFacilitator) ? (
                <textarea
                  className="focused-textarea"
                  value={focusedPostIt.content}
                  onChange={(e) => handleFocusedEdit(e.target.value)}
                  placeholder="Affiner l'idée..."
                />
              ) : (
                focusedPostIt.content
              )}
            </div>
            <div className="focused-footer">
              <span className="focused-author">Proposé par {focusedPostIt.authorName}</span>
              {(focusedPostIt.authorId === userId || isFacilitator) && <span className="edit-hint">(Édition en direct autorisée)</span>}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .board-grid {
          display: grid;
          grid-template-columns: repeat(${room.columns.length}, 1fr);
          gap: 1.5rem;
          height: 100%;
          padding: 1.5rem;
          overflow-x: auto;
          overflow-y: hidden;
          box-sizing: border-box;
        }
        .board-column {
          display: flex;
          flex-direction: column;
          border-radius: 12px;
          background: #f9fafb; /* Gray-50 */
          height: 100%;
          min-width: 280px;
          border: 1px solid var(--border-color);
        }
        .column-header {
          padding: 1rem;
          border-bottom: 1px solid var(--border-color);
          border-top: 4px solid;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
          background: white;
          border-radius: 12px 12px 0 0;
        }
        .column-header h3 { margin: 0; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px; color: var(--text-secondary); font-weight: 600; }
        .btn-add {
          background: white;
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          width: 36px; height: 36px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 1.4rem;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s;
          box-shadow: var(--shadow-sm);
        }
        .btn-add:hover { background: var(--accent-color); color: white; border-color: var(--accent-color); box-shadow: var(--shadow-md); transform: translateY(-1px); }
        .column-content {
          flex: 1;
          padding: 1rem;
          display: flex; flex-direction: column; gap: 1rem;
          overflow-y: auto;
        }
        .postit-item {
          padding: 1rem;
          border-radius: 8px;
          color: #1f2937;
          font-weight: 500;
          font-size: 1rem;
          line-height: 1.5;
          box-shadow: var(--shadow-sm);
          min-height: 100px;
          position: relative;
          transition: transform 0.2s, box-shadow 0.2s;
          word-break: break-word;
          display: flex; flex-direction: column; justify-content: space-between;
          cursor: default;
          border: 1px solid rgba(0,0,0,0.05);
        }
        .postit-item.clickable { cursor: pointer; }
        .postit-item.clickable:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
        .postit-item.adding {
          background-color: #fffbeb; /* Amber-50 */
          border: 2px solid var(--accent-color);
          box-shadow: var(--shadow-md);
        }
        .postit-item.editing {
            box-shadow: 0 0 0 4px var(--accent-glow);
            z-index: 10;
        }
        .postit-item.votable { cursor: pointer; }
        .postit-item.votable:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
        .postit-item.voted { border: 2px solid var(--accent-color); }
        
        .postit-item.stealth { 
          background-color: #e5e7eb !important; /* Gray-200 */
          color: #6b7280;
          border: 2px dashed #d1d5db;
          box-shadow: none;
        }
        .stealth-placeholder {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          height: 100%; gap: 0.5rem; opacity: 0.8;
        }
        .stealth-text { font-size: 0.9rem; font-weight: 600; }

        .postit-footer {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-top: 0.8rem;
          padding-top: 0.4rem;
        }
        .postit-author { font-size: 0.75rem; color: var(--text-secondary); font-weight: 500; }
        .postit-actions { display: flex; align-items: center; gap: 0.5rem; }
        .btn-focus-trigger {
          background: white; border: 1px solid var(--border-color);
          border-radius: 4px; color: var(--text-secondary); cursor: pointer; font-size: 1rem;
          width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
          transition: all 0.2s;
        }
        .btn-focus-trigger:hover { border-color: var(--accent-color); color: var(--accent-color); }

        .postit-item.adding textarea {
          width: 100%; height: 100%; background: transparent; border: none;
          resize: none; outline: none; font-family: inherit; font-size: 1rem;
          color: inherit; font-weight: 500;
        }
        .postit-item.adding textarea::placeholder { color: #9ca3af; }
        .postit-votes { display: flex; flex-wrap: wrap; gap: 4px; }
        .vote-dot { color: var(--accent-color); font-size: 0.8rem; }
        
        .focus-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(5px);
          z-index: 1000; display: flex; align-items: center; justify-content: center;
          padding: 2rem; animation: fadeIn 0.3s ease;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        .focused-postit {
          width: 90%; max-width: 800px; min-height: 400px; padding: 4rem;
          border-radius: 16px; position: relative; box-shadow: var(--shadow-lg);
          display: flex; flex-direction: column; justify-content: center;
          text-align: center; color: #1f2937; transform: rotate(-1deg);
          animation: zoomIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          background-color: #fef3c7; /* Amber-100 default */
          border: 1px solid rgba(0,0,0,0.05);
        }
        @keyframes zoomIn { from { transform: scale(0.8) rotate(0deg); opacity: 0; } to { transform: scale(1) rotate(-1deg); opacity: 1; } }

        .focused-content { font-size: 2.5rem; font-weight: 700; line-height: 1.2; width: 100%; color: #1f2937; }
        .focused-textarea {
            width: 100%; height: 200px; background: transparent; border: none;
            text-align: center; font-size: 2.5rem; font-weight: 700; color: #1f2937;
            outline: none; resize: none; font-family: inherit;
        }
        .focused-footer {
          position: absolute; bottom: 2rem; left: 4rem; right: 4rem;
          display: flex; justify-content: space-between; border-top: 1px solid rgba(0,0,0,0.1);
          padding-top: 1rem; align-items: center;
        }
        .focused-author { font-size: 1.1rem; color: var(--text-secondary); font-weight: 500; }
        .edit-hint { font-size: 0.8rem; color: var(--accent-color); font-weight: bold; background: rgba(255,255,255,0.5); padding: 4px 8px; border-radius: 12px; }
        .btn-close-focus {
          position: absolute; top: 1.5rem; right: 1.5rem; background: rgba(0,0,0,0.05);
          border: none; font-size: 1.5rem; width: 48px; height: 48px; border-radius: 50%;
          cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--text-secondary);
          transition: all 0.2s;
        }
        .btn-close-focus:hover { background: rgba(0,0,0,0.1); color: #1f2937; }

        /* Grouping / Topics Styles */
        .grouping-container {
          display: flex;
          position: relative;
          gap: 1.5rem;
          height: 100%;
          padding: 1.5rem;
          overflow: hidden;
          box-sizing: border-box;
        }
        .grouping-container.with-sidebar {
          display: grid;
          grid-template-columns: 320px 1fr;
        }
        .grouping-container.conclusion-layout {
          height: auto;
          overflow: visible;
        }
        .grouping-main { 
          display: flex; 
          flex-direction: column; 
          gap: 1.5rem; 
          height: 100%; 
          overflow: hidden;
          min-width: 0;
          flex: 1;
        }
        .grouping-main.full-width {
          width: 100%;
        }
        .grouping-main.conclusion-full { 
          padding: 2rem; 
          overflow-y: auto;
          height: 100%;
        }

        .grouping-sidebar {
          display: flex;
          flex-direction: column;
          border-radius: 12px;
          overflow: hidden;
          background: white;
          border: 1px solid var(--border-color);
          height: 100%;
          box-shadow: var(--shadow-sm);
        }
        .sidebar-header {
          padding: 1.5rem;
          border-bottom: 1px solid var(--border-color);
          display: flex; justify-content: space-between; align-items: center;
          background: #f9fafb;
          flex-shrink: 0;
        }
        .sidebar-header h3 { margin: 0; font-size: 0.9rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; }
        .count-badge {
          background: var(--accent-color); color: white;
          padding: 2px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: bold;
        }
        .sidebar-content {
          flex: 1; padding: 1rem; overflow-y: auto;
          display: flex; flex-direction: column; gap: 0.8rem;
          background: #f3f4f6;
        }
        .empty-sidebar { text-align: center; color: var(--text-secondary); margin-top: 2rem; font-style: italic; }

        .topic-creator {
          padding: 1rem; border-radius: 12px; display: flex; gap: 1rem;
          background: white; border: 1px solid var(--border-color);
          flex-shrink: 0; box-shadow: var(--shadow-sm);
        }
        .topic-creator input {
          flex: 1; background: #f9fafb; border: 1px solid var(--border-color);
          color: var(--text-primary); padding: 0.8rem 1.2rem; border-radius: 8px; outline: none; transition: all 0.2s;
        }
        .topic-creator input:focus { border-color: var(--accent-color); background: white; box-shadow: 0 0 0 3px var(--accent-glow); }
        .btn-primary {
            background: var(--accent-color); color: white; border: none; padding: 0.8rem 1.5rem;
            border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s;
        }
        .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }

        .topics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 1.5rem; 
          overflow-y: auto; 
          padding-bottom: 2rem;
          flex: 1;
          align-content: start;
        }
        .topics-grid.conclusion-view {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 1.5rem;
        }
        .topic-card.conclusion-card {
          min-height: auto;
          border-left: 5px solid var(--accent-color);
        }
        .topic-actions.recap {
          background: #f9fafb;
          border: none;
        }
        .no-actions { font-style: italic; opacity: 0.5; font-size: 0.9rem; padding: 0.5rem; }
        
        /* SUMMARY / CONCLUSION STYLES */
        .summary-container {
          display: flex;
          flex-direction: column;
          gap: 2rem;
          max-width: 1200px;
          width: 100%;
          margin: 0 auto;
          padding-bottom: 2rem;
        }
        
        .summary-header-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1.5rem;
          flex-wrap: wrap;
        }
        .summary-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
          flex: 1;
          min-width: 400px;
        }
        .stat-card {
          background: white;
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 1.5rem;
          text-align: center;
          box-shadow: var(--shadow-sm);
        }
        .stat-card.accent {
          background: white;
          border: 2px solid var(--accent-color);
        }
        .stat-card.accent .stat-number { color: var(--accent-color); }
        .stat-number {
          font-size: 2.5rem;
          font-weight: 800;
          line-height: 1;
          margin-bottom: 0.5rem;
          color: #111827;
        }
        .stat-label {
          font-size: 0.85rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 600;
        }
        .btn-export-pdf {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: white;
          color: var(--text-primary);
          border: 1px solid var(--border-color);
          padding: 0.75rem 1.5rem;
          border-radius: 10px;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: var(--shadow-sm);
          white-space: nowrap;
        }
        .btn-export-pdf:hover {
          border-color: var(--retro-red);
          color: var(--retro-red);
          background: #fef2f2;
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }
        .btn-export-pdf:active {
          transform: translateY(0);
        }
        .pdf-icon {
          font-size: 1.1rem;
        }
        
        .summary-section {
          background: white;
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 2rem;
          box-shadow: var(--shadow-sm);
        }
        .section-title {
          margin: 0 0 1.5rem 0;
          font-size: 1.25rem;
          font-weight: 700;
          color: #111827;
          display: flex;
          align-items: center;
          gap: 0.8rem;
        }
        .section-title::before {
          content: '';
          width: 6px;
          height: 24px;
          background: var(--accent-color);
          border-radius: 4px;
        }
        
        .actions-summary {
          display: flex;
          flex-direction: column;
          gap: 0.8rem;
        }
        .action-summary-row {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          background: #f9fafb;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          transition: all 0.2s;
        }
        .action-summary-row:hover { border-color: #d1d5db; background: white; box-shadow: var(--shadow-sm); }
        .action-summary-row.done {
          background: #f0fdf4; /* Green-50 */
          border-color: #bbf7d0;
        }
        .action-checkbox {
          width: 24px; height: 24px;
          border-radius: 50%;
          border: 2px solid #d1d5db;
          display: flex; align-items: center; justify-content: center;
          color: transparent; font-weight: bold;
          flex-shrink: 0;
        }
        .action-summary-row.done .action-checkbox {
          background: var(--retro-green);
          border-color: var(--retro-green);
          color: white;
        }
        .action-details { flex: 1; }
        .action-content { font-size: 1rem; font-weight: 500; color: #374151; }
        .action-summary-row.done .action-content { text-decoration: line-through; color: #6b7280; }
        .action-topic { font-size: 0.8rem; color: #9ca3af; margin-top: 0.2rem; }
        
        .action-assignee {
          display: flex; align-items: center; gap: 0.5rem;
          padding: 0.3rem 0.8rem; background: white; border-radius: 20px;
          border: 1px solid var(--border-color);
        }
        .assignee-avatar {
          width: 20px; height: 20px; border-radius: 50%;
          background: var(--accent-color); color: white;
          font-size: 0.7rem; display: flex; align-items: center; justify-content: center; font-weight: bold;
        }
        .assignee-name { font-size: 0.85rem; font-weight: 500; color: #4b5563; }
        
        /* Topics Summary */
        .topics-summary {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
        }
        .topic-summary-card {
          background: white;
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 1.5rem;
          position: relative;
          display: flex;
          gap: 1rem;
          box-shadow: var(--shadow-sm);
          transition: transform 0.2s;
        }
        .topic-summary-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
        .topic-rank {
          background: #f3f4f6;
          color: var(--text-secondary);
          width: 32px; height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1rem;
          flex-shrink: 0;
        }
        .topic-main {
          flex: 1;
          min-width: 0;
        }
        .topic-summary-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 0.75rem;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .topic-summary-header h4 {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 600;
          color: #111827;
        }
        .topic-badges {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .badge {
          padding: 0.2rem 0.6rem;
          border-radius: 6px;
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
        }
        .badge.votes {
          background: #eff6ff; /* Blue-50 */
          color: var(--accent-color);
          border: 1px solid #bfdbfe;
        }
        .badge.ideas {
          background: #f3f4f6;
          color: #6b7280;
          border: 1px solid #e5e7eb;
        }
        .badge.actions {
          background: #ecfdf5; /* Green-50 */
          color: var(--retro-green);
          border: 1px solid #a7f3d0;
        }
        .topic-ideas-preview {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          align-items: center;
        }
        .idea-chip {
          padding: 0.3rem 0.6rem;
          border-radius: 4px;
          font-size: 0.8rem;
          color: #1f2937;
          border: 1px solid rgba(0,0,0,0.05);
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .more-ideas {
          font-size: 0.8rem;
          color: var(--text-secondary);
          font-style: italic;
        }
        
        /* Participants Summary */
        .participants-summary {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
        }
        .participant-chip {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: white;
          border-radius: 24px;
          border: 1px solid var(--border-color);
          box-shadow: var(--shadow-sm);
        }
        .participant-avatar {
          width: 28px;
          height: 28px;
          background: linear-gradient(135deg, var(--accent-color), #8b5cf6);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.8rem;
          font-weight: 600;
          color: white;
        }
        .participant-name {
          font-size: 0.9rem;
          font-weight: 500;
          color: #374151;
        }
        .facilitator-badge {
          font-size: 0.65rem;
          padding: 0.15rem 0.4rem;
          background: var(--accent-color);
          color: white;
          border-radius: 4px;
          text-transform: uppercase;
          font-weight: 700;
        }

        /* ACTIONS PHASE - Full screen topic focus */
        .actions-phase-container {
          display: grid;
          grid-template-columns: 1fr 280px;
          gap: 1.5rem;
          height: 100%;
          overflow: hidden;
        }

        .focused-topic-card {
          display: flex;
          flex-direction: column;
          background: white;
          border: 1px solid var(--border-color);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: var(--shadow-md);
        }

        .focused-topic-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem 2rem;
          background: #f9fafb;
          border-bottom: 1px solid var(--border-color);
        }

        .topic-info {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .topic-rank-badge {
          background: var(--accent-color);
          color: white;
          padding: 0.4rem 0.8rem;
          border-radius: 8px;
          font-weight: 700;
          font-size: 0.9rem;
        }

        .focused-topic-header h2 {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 700;
          color: #111827;
        }

        .votes-badge {
          background: white;
          border: 1px solid var(--border-color);
          padding: 0.3rem 0.8rem;
          border-radius: 20px;
          font-size: 0.85rem;
          color: var(--text-secondary);
          font-weight: 500;
        }

        .topic-progress {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.9rem;
          color: var(--text-secondary);
        }

        .done-count {
          color: var(--retro-green);
          font-weight: 600;
        }

        .separator {
          opacity: 0.3;
        }

        .focused-topic-postits {
          padding: 1.5rem 2rem;
          border-bottom: 1px solid var(--border-color);
          background: #fafafa;
        }

        .focused-topic-postits h4,
        .focused-topic-actions h4 {
          margin: 0 0 1rem 0;
          font-size: 0.85rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--text-secondary);
          font-weight: 600;
        }

        .postits-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
        }

        .postit-mini-card {
          padding: 0.75rem 1rem;
          border-radius: 6px;
          color: #1f2937;
          font-size: 0.9rem;
          font-weight: 500;
          box-shadow: var(--shadow-sm);
          max-width: 250px;
          border: 1px solid rgba(0,0,0,0.05);
        }

        .postit-mini-card .postit-text {
          margin-bottom: 0.5rem;
          line-height: 1.3;
        }

        .postit-mini-card .postit-author {
          font-size: 0.7rem;
          color: rgba(0,0,0,0.5);
          font-style: italic;
        }

        .focused-topic-actions {
          flex: 1;
          padding: 1.5rem 2rem;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          background: white;
        }

        .actions-list-focused {
          display: flex;
          flex-direction: column;
          gap: 0.8rem;
          margin-bottom: 1rem;
          flex: 1;
          overflow-y: auto;
        }

        .action-item-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          background: white;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          border-left: 3px solid var(--accent-color);
          box-shadow: var(--shadow-sm);
        }

        .action-item-row.done {
          background: #f9fafb;
          border-left-color: var(--retro-green);
          opacity: 0.8;
        }

        .action-item-row.done .action-text {
          text-decoration: line-through;
          color: #6b7280;
        }

        .action-item-row input[type="checkbox"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
          accent-color: var(--retro-green);
        }

        .action-item-row .action-text {
          flex: 1;
          font-size: 0.95rem;
          font-weight: 500;
        }

        .action-item-row .action-owner {
          font-size: 0.8rem;
          color: var(--accent-color);
          font-weight: 600;
          background: #eff6ff;
          padding: 2px 8px;
          border-radius: 12px;
        }

        .action-item-row .btn-del {
          background: transparent;
          border: none;
          color: #9ca3af;
          cursor: pointer;
          font-size: 1.4rem;
          padding: 0 0.5rem;
          transition: color 0.2s;
          display: flex; align-items: center;
        }

        .action-item-row .btn-del:hover {
          color: #ef4444;
        }

        .add-action-form {
          display: flex;
          gap: 0.75rem;
          margin-top: auto;
          padding-top: 1rem;
          border-top: 1px solid var(--border-color);
        }

        .add-action-form input {
          flex: 1;
          background: #f9fafb;
          border: 1px solid var(--border-color);
          color: #1f2937;
          padding: 0.75rem 1rem;
          border-radius: 8px;
          font-size: 0.9rem;
        }

        .add-action-form input:focus {
          outline: none;
          border-color: var(--accent-color);
          background: white;
          box-shadow: 0 0 0 3px var(--accent-glow);
        }

        .add-action-form select {
          background: white;
          border: 1px solid var(--border-color);
          color: #1f2937;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          font-size: 0.85rem;
          min-width: 120px;
        }

        .btn-add-action {
          background: var(--accent-color);
          border: none;
          color: white;
          padding: 0 1.5rem;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
          display: flex; align-items: center; justify-content: center;
        }

        .btn-add-action:hover {
          background: #1d4ed8;
        }

        .topic-navigation {
          padding: 1.5rem 2rem;
          border-top: 1px solid var(--border-color);
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
          background: #f9fafb;
        }

        .btn-complete-topic {
          background: var(--retro-green);
          border: none;
          color: white;
          padding: 0.75rem 2rem;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
        }

        .btn-complete-topic:hover {
          background: #059669;
          transform: translateY(-1px);
          box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);
        }

        /* Topics sidebar */
        .topics-sidebar {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          overflow-y: auto;
          padding-right: 0.5rem;
        }

        .sidebar-section h5 {
          margin: 0 0 0.75rem 0;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--text-secondary);
          font-weight: 600;
        }

        .sidebar-topic-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          background: white;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          margin-bottom: 0.5rem;
          border-left: 3px solid transparent;
          box-shadow: var(--shadow-sm);
        }

        .sidebar-topic-item.clickable {
          cursor: pointer;
          transition: all 0.2s;
        }

        .sidebar-topic-item.clickable:hover {
          border-color: #d1d5db;
          border-left-color: var(--accent-color);
          transform: translateX(2px);
        }

        .sidebar-topic-item .topic-order {
          background: #f3f4f6;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: 600;
          flex-shrink: 0;
          color: #4b5563;
        }

        .sidebar-topic-item .topic-name {
          flex: 1;
          font-size: 0.9rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-weight: 500;
          color: #374151;
        }

        .sidebar-topic-item .topic-votes {
          font-size: 0.75rem;
          color: var(--accent-color);
          font-weight: 600;
        }

        .sidebar-topic-item.done {
          background: #f9fafb;
          opacity: 0.7;
        }

        .sidebar-topic-item .check-icon {
          color: var(--retro-green);
          font-weight: bold;
        }

        .sidebar-topic-item .action-count {
          font-size: 0.75rem;
          background: #ecfdf5;
          color: var(--retro-green);
          padding: 0.15rem 0.5rem;
          border-radius: 10px;
          font-weight: 600;
        }

        .done-section {
          border-top: 1px solid var(--border-color);
          padding-top: 1rem;
        }

        /* All topics done state */
        .all-topics-done {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          text-align: center;
          grid-column: 1 / -1;
        }

        .done-message {
          margin-bottom: 2rem;
        }

        .done-message .done-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 80px;
          height: 80px;
          background: #ecfdf5;
          color: var(--retro-green);
          border-radius: 50%;
          font-size: 2.5rem;
          margin-bottom: 1rem;
        }

        .done-message h2 {
          margin: 0 0 0.5rem 0;
          font-size: 1.5rem;
          font-weight: 700;
          color: #111827;
        }

        .done-message p {
          margin: 0;
          color: var(--text-secondary);
        }

        .review-topics h4 {
          margin: 0 0 1rem 0;
          font-size: 0.9rem;
          color: var(--text-secondary);
          font-weight: 600;
        }

        .topics-review-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          justify-content: center;
        }

        .review-topic-card {
          background: white;
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 1rem 1.5rem;
          text-align: center;
          box-shadow: var(--shadow-sm);
        }

        .review-topic-card.clickable {
          cursor: pointer;
          transition: all 0.2s;
        }

        .review-topic-card.clickable:hover {
          border-color: var(--accent-color);
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }

        .review-topic-card h5 {
          margin: 0 0 0.5rem 0;
          font-size: 1rem;
          font-weight: 600;
          color: #1f2937;
        }

        .review-topic-card span {
          font-size: 0.85rem;
          color: var(--retro-green);
          font-weight: 500;
        }

        @media (max-width: 900px) {
          .actions-phase-container {
            grid-template-columns: 1fr;
          }
          .topics-sidebar {
            display: none;
          }
        }
        
        @media (max-width: 768px) {
          .summary-stats {
            grid-template-columns: repeat(2, 1fr);
          }
          .action-summary-row {
            flex-wrap: wrap;
          }
          .action-assignee {
            width: 100%;
            justify-content: center;
          }
          .topic-summary-header {
            flex-direction: column;
          }
        }
        .topic-card {
          border-radius: 12px; display: flex; flex-direction: column;
          background: white; min-height: 250px;
          border: 1px solid var(--border-color); transition: transform 0.2s, box-shadow 0.2s;
          overflow: hidden;
          box-shadow: var(--shadow-sm);
        }
        .topic-header {
          padding: 1rem 1.5rem; display: flex; justify-content: space-between; align-items: center;
          background: #f9fafb; border-bottom: 1px solid var(--border-color);
        }
        .topic-header h4 { margin: 0; font-size: 1.1rem; color: #111827; font-weight: 600; }
        .btn-delete-topic { background: transparent; border: none; color: #9ca3af; cursor: pointer; }
        .btn-delete-topic:hover { color: #f44336; }

        .topic-content { padding: 1rem; display: flex; flex-direction: column; gap: 1.5rem; overflow: hidden; }
        .topic-postits { display: flex; flex-wrap: wrap; gap: 0.5rem; }
        
        .voting-status-bar {
          padding: 1rem 1.5rem; border-radius: 12px; display: flex; justify-content: space-between;
          align-items: center; background: var(--accent-color); color: white; margin-bottom: 1rem;
          box-shadow: var(--shadow-md);
        }
        .voting-revealed { font-weight: bold; display: flex; align-items: center; gap: 1rem; }
        .btn-tie-break {
          background: white; color: var(--accent-color); border: none;
          padding: 0.5rem 1rem; border-radius: 20px; font-size: 0.9rem;
          font-weight: bold; cursor: pointer; animation: pulse 2s infinite;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .topic-title-row { display: flex; align-items: center; gap: 1rem; }
        .topic-voting-controls { display: flex; gap: 0.5rem; }
        .topic-voting-controls button {
          width: 28px; height: 28px; border-radius: 6px; border: 1px solid #d1d5db;
          background: white; color: var(--text-secondary); cursor: pointer; display: flex;
          align-items: center; justify-content: center; font-size: 1.1rem; transition: all 0.2s;
          box-shadow: var(--shadow-sm);
        }
        .topic-voting-controls button:hover:not(:disabled) { background: var(--accent-color); color: white; border-color: var(--accent-color); }
        .topic-vote-count {
          background: #eff6ff; padding: 2px 8px; border-radius: 12px;
          font-size: 0.8rem; font-weight: bold; color: var(--accent-color);
          border: 1px solid #bfdbfe;
        }
        .topic-header-actions { display: flex; align-items: center; gap: 0.5rem; }
        
        /* Action Items Section */
        .topic-actions {
          background: #f9fafb; padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color);
          overflow: hidden; box-sizing: border-box;
        }
        .topic-actions h5 { margin: 0 0 1rem 0; font-size: 0.8rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 600; }
        .actions-list { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
        .action-row {
          display: flex; align-items: center; gap: 0.8rem; background: white;
          padding: 0.5rem 0.8rem; border-radius: 4px; font-size: 0.9rem;
          border: 1px solid var(--border-color);
        }
        .action-row.done { opacity: 0.6; text-decoration: line-through; background: #f3f4f6; }
        .action-text { flex: 1; color: #374151; }
        .action-owner { font-size: 0.75rem; color: var(--accent-color); font-weight: bold; background: #eff6ff; padding: 1px 6px; border-radius: 4px; }
        .btn-del-action { background: transparent; border: none; color: #9ca3af; cursor: pointer; padding: 0 5px; }
        .btn-del-action:hover { color: #ef4444; }

        .action-input-row { display: flex; gap: 0.5rem; flex-wrap: wrap; }
        .action-input-row input {
          flex: 1; min-width: 120px; background: white; border: 1px solid var(--border-color);
          color: #1f2937; padding: 0.4rem 0.8rem; border-radius: 4px; font-size: 0.85rem;
          box-sizing: border-box;
        }
        .action-input-row input:focus { outline: none; border-color: var(--accent-color); }
        .action-input-row select {
          background: white; border: 1px solid var(--border-color);
          color: #1f2937; border-radius: 4px; padding: 0.2rem 0.4rem; font-size: 0.8rem;
          max-width: 120px; box-sizing: border-box;
        }
        .action-input-row button {
          background: var(--accent-color); border: none; color: white;
          border-radius: 4px; width: 30px; min-width: 30px; cursor: pointer; flex-shrink: 0;
        }
      `}</style>
    </div>
    </>
  );
};
