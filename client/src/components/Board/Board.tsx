import React, { useState } from 'react';
import { useRoom } from '../../context/RoomContext';
import { useSocket } from '../../context/SocketContext';
import { Column, PostIt, Participant, Group, ActionItem } from '../../../../shared/types';
import { t } from '../../i18n';
import { PhaseTutorial } from '../PhaseTutorial';

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

  // Check if we should use the Thematic grouping view
  // Persistent for GROUPING, VOTING, BRAINSTORM, ACTIONS, CONCLUSION
  const isThematicPhase = ['GROUPING', 'VOTING', 'BRAINSTORM', 'ACTIONS', 'CONCLUSION'].includes(room.phase);

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
              {/* Stats Header */}
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
          ) : (
            /* OTHER THEMATIC PHASES (GROUPING, VOTING, ACTIONS) */
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
          
          .summary-stats {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 1rem;
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
          background: rgba(255, 255, 255, 0.02);
          height: 100%;
          min-width: 280px;
          transition: background 0.2s;
        }
        .column-header {
          padding: 1rem;
          background: rgba(255, 255, 255, 0.03);
          border-top: 4px solid;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
        }
        .column-header h3 { margin: 0; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; color: var(--text-secondary); }
        .btn-add {
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: white;
          width: 28px; height: 28px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 1.2rem;
          display: flex; align-items: center; justify-content: center;
        }
        .btn-add:hover { background: var(--accent-color); }
        .column-content {
          flex: 1;
          padding: 1rem;
          display: flex; flex-direction: column; gap: 1rem;
          overflow-y: auto;
        }
        .postit-item {
          padding: 0.8rem;
          border-radius: 4px;
          color: #000;
          font-weight: 500;
          font-size: 1.1rem;
          line-height: 1.4;
          box-shadow: 2px 2px 8px rgba(0,0,0,0.2);
          min-height: 120px;
          position: relative;
          transition: transform 0.2s, box-shadow 0.2s;
          word-break: break-word;
          display: flex; flex-direction: column; justify-content: space-between;
          cursor: default;
        }
        .postit-item.clickable { cursor: pointer; }
        .postit-item.clickable:hover { transform: scale(1.03); }
        .postit-item.adding {
          background-color: #fff9c4;
          border: 2px solid var(--accent-color);
        }
        .postit-item.editing {
            box-shadow: 0 0 15px var(--accent-glow);
            z-index: 10;
        }
        .postit-item.votable { cursor: pointer; }
        .postit-item.votable:hover { transform: scale(1.05); box-shadow: 0 0 15px var(--accent-glow); }
        .postit-item.voted { border: 2px dashed var(--accent-color); }
        
        .postit-item.stealth { 
          background-color: #333 !important; 
          color: #888;
          border: 1px dashed #555;
        }
        .stealth-placeholder {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          height: 100%; gap: 0.5rem; opacity: 0.6;
        }
        .stealth-text { font-size: 0.8rem; }

        .postit-footer {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-top: 0.8rem;
          border-top: 1px solid rgba(0,0,0,0.05);
          padding-top: 0.4rem;
        }
        .postit-author { font-size: 0.75rem; color: rgba(0,0,0,0.5); font-style: italic; }
        .postit-actions { display: flex; align-items: center; gap: 0.5rem; }
        .btn-focus-trigger {
          background: rgba(0,0,0,0.05); border: 1px solid rgba(0,0,0,0.1);
          border-radius: 4px; color: #000; cursor: pointer; font-size: 1rem;
          width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
        }
        .btn-focus-trigger:hover { background: var(--accent-color); color: white; border-color: var(--accent-color); }

        .postit-item.adding textarea {
          width: 100%; height: 100%; background: transparent; border: none;
          resize: none; outline: none; font-family: inherit; font-size: 1.1rem;
          color: #000 !important; font-weight: 500;
        }
        .postit-item.adding textarea::placeholder { color: rgba(0,0,0,0.4); }
        .postit-votes { display: flex; flex-wrap: wrap; gap: 2px; }
        .vote-dot { color: var(--accent-color); font-size: 0.8rem; }
        
        .focus-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.85); backdrop-filter: blur(10px);
          z-index: 1000; display: flex; align-items: center; justify-content: center;
          padding: 2rem; animation: fadeIn 0.3s ease;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        .focused-postit {
          width: 90%; max-width: 800px; min-height: 400px; padding: 4rem;
          border-radius: 12px; position: relative; box-shadow: 0 20px 50px rgba(0,0,0,0.5);
          display: flex; flex-direction: column; justify-content: center;
          text-align: center; color: #000; transform: rotate(-1deg);
          animation: zoomIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        @keyframes zoomIn { from { transform: scale(0.8) rotate(0deg); opacity: 0; } to { transform: scale(1) rotate(-1deg); opacity: 1; } }

        .focused-content { font-size: 2.1rem; font-weight: 600; line-height: 1.2; width: 100%; }
        .focused-textarea {
            width: 100%; height: 200px; background: transparent; border: none;
            text-align: center; font-size: 2.1rem; font-weight: 600; color: #000;
            outline: none; resize: none; font-family: inherit;
        }
        .focused-footer {
          position: absolute; bottom: 2rem; left: 4rem; right: 4rem;
          display: flex; justify-content: space-between; border-top: 2px solid rgba(0,0,0,0.1);
          padding-top: 1rem; align-items: center;
        }
        .focused-author { font-size: 1.2rem; font-style: italic; opacity: 0.6; }
        .edit-hint { font-size: 0.8rem; color: var(--accent-color); font-weight: bold; }
        .btn-close-focus {
          position: absolute; top: 1.5rem; right: 1.5rem; background: rgba(0,0,0,0.1);
          border: none; font-size: 1.5rem; width: 40px; height: 40px; border-radius: 50%;
          cursor: pointer; display: flex; align-items: center; justify-content: center; color: #000;
        }
        .btn-close-focus:hover { background: rgba(0,0,0,0.2); }
      `}</style>
    </div>
    </>
  );
};
